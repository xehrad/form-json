(function () {
  let api;

  const _ConfigIgnoreDeepKey_ = "ignore-deep-key";
  const _ConfigIgnoreDropFalseOption_ = "ignore-drop-false-option";
  const _ConfigIgnoreDropFalseOptionArray_ = "ignore-drop-false-option-array";

  const _Append_ = Symbol("append");

  htmx.defineExtension("form-json", {
    init: function (apiRef) {
      api = apiRef;
    },

    onEvent: function (name, evt) {
      if (name === "htmx:configRequest") {
        evt.detail.headers["Content-Type"] = "application/json";
      }
    },

    encodeParameters: function (xhr, parameters, elt) {
      xhr.overrideMimeType("application/json");

      const context = createContext(elt);
      const entries = normalizeEntries(parameters, context);

      const result = context.ignoreDeepKey ? encodeFlat(entries) : encodeNested(entries);

      return JSON.stringify(result);
    },
  });

  function createContext(requestElement) {
    const form = getRelatedForm(requestElement);
    const fieldRoot = form || requestElement;
    const controls = getControls(fieldRoot);

    return {
      requestElement,
      form,
      controls,
      controlsByName: indexControlsByName(controls),

      expressionVars: api.getExpressionVars(requestElement) || {},

      ignoreDeepKey: hasConfigAttribute(requestElement, form, _ConfigIgnoreDeepKey_),

      keepFalseCheckbox: hasConfigAttribute(requestElement, form, _ConfigIgnoreDropFalseOption_),

      keepFalseCheckboxArray: hasConfigAttribute(requestElement, form, _ConfigIgnoreDropFalseOptionArray_),
    };
  }

  function getRelatedForm(elt) {
    if (elt instanceof HTMLFormElement) {
      return elt;
    }

    if (elt.form instanceof HTMLFormElement) {
      return elt.form;
    }

    if (typeof elt.closest === "function") {
      const form = elt.closest("form");

      if (form instanceof HTMLFormElement) {
        return form;
      }
    }

    return null;
  }

  function getControls(root) {
    if (root instanceof HTMLFormElement) {
      return Array.from(root.elements);
    }

    if (typeof root.querySelectorAll === "function") {
      return Array.from(root.querySelectorAll("[name]"));
    }

    return [];
  }

  function indexControlsByName(controls) {
    const index = new Map();

    for (const control of controls) {
      if (!control.name) {
        continue;
      }

      if (!index.has(control.name)) {
        index.set(control.name, []);
      }

      index.get(control.name).push(control);
    }

    return index;
  }

  function hasConfigAttribute(requestElement, form, name) {
    if (api.hasAttribute(requestElement, name)) {
      return true;
    }

    return form !== null && form !== requestElement && api.hasAttribute(form, name);
  }

  /**
   * Convert HTMX/FormData values into a normalized sequence:
   *
   * [
   *   { name: 'name', value: 'John' },
   *   { name: 'age', value: 30 },
   *   { name: 'list', value: [1, 2, 3] }
   * ]
   *
   * DOM-specific concerns such as checkbox handling and input type
   * conversion stop here.
   */
  function normalizeEntries(parameters, context) {
    const values = new Map();

    const checkboxGroups = getCheckboxGroups(context.controls);

    const checkboxNames = new Set(checkboxGroups.keys());

    /*
     * Handle checkboxes separately because unchecked checkboxes are not
     * included in normal FormData/HTMX parameters.
     */
    for (const [name, group] of checkboxGroups) {
      const normalizedName = name.endsWith("[]") ? name.slice(0, -2) : name;

      /*
       * Multiple checkboxes with the same name are represented as
       * an array.
       */
      if (group.length > 1) {
        const groupValues = [];

        for (const input of group) {
          if (input.checked) {
            groupValues.push(getCheckboxValue(input));
          } else if (context.keepFalseCheckboxArray) {
            groupValues.push(false);
          }
        }

        values.set(normalizedName, groupValues);

        continue;
      }

      /*
       * Single checkbox.
       */
      const input = group[0];

      if (input.checked) {
        values.set(normalizedName, getCheckboxValue(input));
      } else if (context.keepFalseCheckbox) {
        values.set(normalizedName, false);
      }
    }

    /*
     * Track which field instance belongs to which FormData entry.
     *
     * Example:
     *
     * <input name="list" type="number" value="1">
     * <input name="list" type="number" value="2">
     *
     * FormData contains two "list" entries. We want each value to use
     * the corresponding input metadata.
     */
    const occurrences = new Map();

    for (const [name, value] of parameters.entries()) {
      /*
       * Checkbox values have already been normalized above.
       */
      if (checkboxNames.has(name)) {
        continue;
      }

      const occurrence = occurrences.get(name) || 0;

      const control = getControlForOccurrence(context.controlsByName, name, occurrence);

      occurrences.set(name, occurrence + 1);

      const normalizedValue = normalizeValue(control, value);

      appendEntryValue(values, name, normalizedValue);
    }

    /*
     * HTMX/FormData may stringify values originating from hx-vals
     * or hx-vars.
     *
     * Restore their original JS types.
     *
     * Example:
     *
     * hx-vals='{"count": 5, "enabled": true}'
     *
     * must remain:
     *
     * {
     *   count: 5,
     *   enabled: true
     * }
     *
     * rather than:
     *
     * {
     *   count: "5",
     *   enabled: "true"
     * }
     */
    for (const name of values.keys()) {
      if (Object.prototype.hasOwnProperty.call(context.expressionVars, name)) {
        values.set(name, context.expressionVars[name]);
      }
    }

    return Array.from(values, ([name, value]) => ({
      name,
      value,
    }));
  }

  function getCheckboxGroups(controls) {
    const groups = new Map();

    for (const control of controls) {
      if (!(control instanceof HTMLInputElement) || control.type !== "checkbox" || !control.name) {
        continue;
      }

      if (!groups.has(control.name)) {
        groups.set(control.name, []);
      }

      groups.get(control.name).push(control);
    }

    return groups;
  }

  function getCheckboxValue(input) {
    return input.value && input.value !== "on" ? input.value : true;
  }

  function getControlForOccurrence(index, name, occurrence) {
    const controls = index.get(name);

    if (!controls || controls.length === 0) {
      return null;
    }

    /*
     * A <select multiple> may produce several FormData entries from
     * a single control, so reuse the last available control metadata.
     */
    return controls[Math.min(occurrence, controls.length - 1)];
  }

  function normalizeValue(control, value) {
    if (!control) {
      return value;
    }

    if (control.type === "number" || control.type === "range") {
      return Number(value);
    }

    return value;
  }

  /**
   * Multiple form controls can use the same name.
   *
   * Example:
   *
   * list=1
   * list=2
   * list=3
   *
   * becomes:
   *
   * list: [1, 2, 3]
   */
  function appendEntryValue(values, name, value) {
    if (!values.has(name)) {
      values.set(name, value);
      return;
    }

    const current = values.get(name);

    if (Array.isArray(current)) {
      current.push(value);
      return;
    }

    values.set(name, [current, value]);
  }

  /**
   * ignore-deep-key:
   *
   * wow.deep[0] => {
   *   "wow.deep[0]": value
   * }
   */
  function encodeFlat(entries) {
    const result = {};

    for (const entry of entries) {
      result[entry.name] = entry.value;
    }

    return result;
  }

  /**
   * Normal deep-key mode.
   */
  function encodeNested(entries) {
    const result = {};

    for (const entry of entries) {
      const path = parsePath(entry.name);

      setPathValue(result, path, entry.value);
    }

    return result;
  }

  /**
   * Supported:
   *
   * pet.name
   *
   * pet[name]
   *
   * data.person[2].name
   *
   * wow.such[deep][3][much].power[!]
   *
   * highlander[]
   *
   * Invalid/malformed paths fall back to a literal key.
   */
  function parsePath(name) {
    const path = [];

    let buffer = "";
    let i = 0;

    const pushBuffer = function () {
      if (buffer.length === 0) {
        return;
      }

      path.push(buffer);
      buffer = "";
    };

    while (i < name.length) {
      const char = name[i];

      /*
       * Dot notation.
       */
      if (char === ".") {
        if (buffer.length > 0) {
          pushBuffer();
        } else if (i === 0 || name[i - 1] === ".") {
          return [name];
        }

        i++;
        continue;
      }

      /*
       * Bracket notation.
       */
      if (char === "[") {
        pushBuffer();

        const end = name.indexOf("]", i + 1);

        if (end === -1) {
          return [name];
        }

        const part = name.slice(i + 1, end);

        path.push(part.trim() === "" ? _Append_ : part);

        i = end + 1;

        /*
         * After ] only another [ or . is valid.
         */
        if (i < name.length && name[i] !== "." && name[i] !== "[") {
          return [name];
        }

        continue;
      }

      /*
       * Unmatched closing bracket.
       */
      if (char === "]") {
        return [name];
      }

      buffer += char;
      i++;
    }

    pushBuffer();

    if (path.length === 0) {
      return [name];
    }

    /*
     * [] append notation is only supported at the end.
     */
    for (let j = 0; j < path.length - 1; j++) {
      if (path[j] === _Append_) {
        return [name];
      }
    }

    return path;
  }

  /**
   * Insert a value directly into the final JSON tree.
   *
   * There is intentionally no intermediate flag map.
   */
  function setPathValue(root, path, value) {
    let current = root;

    for (let i = 0; i < path.length; i++) {
      const part = path[i];

      const isLast = i === path.length - 1;

      /*
       * Leaf.
       */
      if (isLast) {
        if (part === _Append_) {
          appendToContainer(current, value);
        } else {
          setLeafValue(current, part, value);
        }

        return;
      }

      /*
       * parsePath() prevents [] in the middle of a path.
       */
      if (part === _Append_) {
        return;
      }

      const next = path[i + 1];

      const wantsArray = next === _Append_ || isArrayIndex(next);

      current = ensureChildContainer(current, part, wantsArray);
    }
  }

  /**
   * Ensure parent[key] is usable as the next container.
   *
   * It also handles conflicts such as:
   *
   * mix = "scalar"
   * mix[0] = "array value"
   *
   * by preserving:
   *
   * {
   *   mix: {
   *     "": "scalar",
   *     "0": "array value"
   *   }
   * }
   */
  function ensureChildContainer(parent, key, wantsArray) {
    const existing = parent[key];

    /*
     * Nothing exists yet.
     */
    if (existing === undefined) {
      const child = wantsArray ? [] : {};

      parent[key] = child;

      return child;
    }

    /*
     * Existing array.
     */
    if (Array.isArray(existing)) {
      if (wantsArray) {
        return existing;
      }

      /*
       * Array/object conflict.
       *
       * Convert:
       *
       * ["A", , "C"]
       *
       * into:
       *
       * {
       *   "0": "A",
       *   "2": "C"
       * }
       */
      const child = arrayToObject(existing);

      parent[key] = child;

      return child;
    }

    /*
     * Existing object.
     *
     * Keep it even if the new path looks array-like.
     * This prevents previously submitted data from being lost.
     */
    if (isObject(existing)) {
      return existing;
    }

    /*
     * Scalar/container conflict.
     *
     * Preserve scalar using the empty-string key.
     */
    const child = {
      "": existing,
    };

    parent[key] = child;

    return child;
  }

  /**
   * Set the final value.
   */
  function setLeafValue(parent, key, value) {
    const existing = parent[key];

    if (existing === undefined) {
      parent[key] = value;
      return;
    }

    /*
     * Existing array + scalar collision.
     */
    if (Array.isArray(existing)) {
      const object = arrayToObject(existing);

      object[""] = value;

      parent[key] = object;

      return;
    }

    /*
     * Existing structured value + scalar collision.
     */
    if (isObject(existing)) {
      existing[""] = value;
      return;
    }

    /*
     * Two syntactically different field names may resolve to the exact
     * same JSON path:
     *
     * pet.name
     * pet[name]
     *
     * In that case the later field wins.
     */
    parent[key] = value;
  }

  /**
   * Append notation:
   *
   * highlander[]=one
   * highlander[]=two
   *
   * ->
   *
   * {
   *   highlander: [
   *     "one",
   *     "two"
   *   ]
   * }
   */
  function appendToContainer(container, value) {
    if (Array.isArray(container)) {
      if (Array.isArray(value)) {
        container.push(...value);
      } else {
        container.push(value);
      }

      return;
    }

    /*
     * This case can happen if a structural collision previously promoted
     * the expected array into an object.
     *
     * Preserve existing values by finding the next numeric key.
     */
    let index = 0;

    while (Object.prototype.hasOwnProperty.call(container, String(index))) {
      index++;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        container[String(index)] = item;

        index++;
      }
    } else {
      container[String(index)] = value;
    }
  }

  /**
   * Convert an array into an object while preserving populated indexes.
   *
   * Example:
   *
   * [
   *   "A",
   *   <empty>,
   *   "C"
   * ]
   *
   * ->
   *
   * {
   *   "0": "A",
   *   "2": "C"
   * }
   */
  function arrayToObject(array) {
    const object = {};

    for (let i = 0; i < array.length; i++) {
      if (Object.prototype.hasOwnProperty.call(array, i)) {
        object[String(i)] = array[i];
      }
    }

    return object;
  }

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function isArrayIndex(value) {
    return typeof value === "string" && /^\d+$/.test(value);
  }
})();
