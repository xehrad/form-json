(function () {
  const EXTENSION_NAME = "form-json";

  const _ConfigIgnoreDeepKey_ = "ignore-deep-key";
  const _ConfigIgnoreDropFalseOption_ = "ignore-drop-false-option";
  const _ConfigIgnoreDropFalseOptionArray_ =
    "ignore-drop-false-option-array";

  /*
   * htmx v4 mutates FormData after htmx:config:request.
   *
   * We normalize and preserve the request data at config-request time,
   * then replace the final request body at before-request time.
   */
  const requests = new WeakMap();

  htmx.registerExtension(EXTENSION_NAME, {
    /*
     * At this point:
     *
     *   detail.ctx.request.body === FormData
     *
     * and:
     *
     *   detail.ctx.vals
     *
     * contains the original typed hx-vals values.
     */
    htmx_config_request: function (elt, detail) {
      const ctx = detail.ctx;

      if (!isEnabledForRequest(elt, ctx)) {
        return;
      }

      const form =
        ctx.request.form ||
        getRelatedForm(elt);

      const fieldRoot =
        form ||
        elt;

      const controls =
        getControls(fieldRoot);

      const context = {
        requestElement: elt,

        form,

        controls,

        controlsByName:
          indexControlsByName(controls),

        /*
         * htmx v4 deliberately stores the typed hx-vals
         * object here for JSON extensions.
         */
        expressionVars:
          ctx.vals || {},

        ignoreDeepKey:
          hasConfigAttribute(
            elt,
            form,
            _ConfigIgnoreDeepKey_
          ),

        keepFalseCheckbox:
          hasConfigAttribute(
            elt,
            form,
            _ConfigIgnoreDropFalseOption_
          ),

        keepFalseCheckboxArray:
          hasConfigAttribute(
            elt,
            form,
            _ConfigIgnoreDropFalseOptionArray_
          ),
      };

      requests.set(ctx, {
        entries:
          normalizeEntries(
            ctx.request.body,
            context
          ),

        ignoreDeepKey:
          context.ignoreDeepKey,

        /*
         * htmx v4 moves DELETE parameters into the URL.
         * Keep the original action so DELETE can still
         * be sent using a JSON body.
         */
        originalAction:
          ctx.request.action,
      });
    },

    /*
     * In htmx v4 encodeParameters() no longer exists.
     *
     * The final request body must be replaced here.
     */
    htmx_before_request: function (_elt, detail) {
      const ctx = detail.ctx;

      const request =
        requests.get(ctx);

      if (!request) {
        return;
      }

      requests.delete(ctx);

      const method =
        String(
          ctx.request.method || "GET"
        ).toUpperCase();

      /*
       * Fetch does not allow request bodies for GET.
       *
       * htmx has already moved GET parameters into
       * the URL, so leave GET untouched.
       */
      if (
        method === "GET" ||
        method === "HEAD"
      ) {
        return;
      }

      const result =
        request.ignoreDeepKey
          ? encodeFlat(request.entries)
          : encodeNested(request.entries);

      /*
       * htmx v4 moves DELETE parameters to the URL.
       *
       * form-json explicitly represents the request
       * as JSON, so restore the URL before htmx added
       * those form parameters.
       */
      if (method === "DELETE") {
        ctx.request.action =
          request.originalAction;
      }

      ctx.request.headers[
        "Content-Type"
      ] = "application/json";

      ctx.request.body =
        JSON.stringify(result);
    },
  });

  /*
   * ----------------------------------------------------------------
   * Extension activation
   * ----------------------------------------------------------------
   */

  /**
   * htmx 4 extensions are registered globally.
   *
   * The old form-json API however used:
   *
   *   hx-ext="form-json"
   *
   * Preserve that API by interpreting hx-ext ourselves.
   */
  function isEnabledForRequest(
    elt,
    ctx
  ) {
    const form =
      ctx.request.form ||
      getRelatedForm(elt);

    const requestDirective =
      findExtensionDirective(elt);

    if (requestDirective !== null) {
      return requestDirective;
    }

    if (
      form &&
      form !== elt
    ) {
      const formDirective =
        findExtensionDirective(form);

      if (formDirective !== null) {
        return formDirective;
      }
    }

    return false;
  }

  /**
   * Supports:
   *
   *   hx-ext="form-json"
   *
   *   hx-ext="foo, form-json"
   *
   *   data-hx-ext="form-json"
   *
   * and:
   *
   *   hx-ext="ignore:form-json"
   */
  function findExtensionDirective(
    start
  ) {
    let current = start;

    while (
      current instanceof Element
    ) {
      const value =
        current.getAttribute(
          "hx-ext"
        ) ??
        current.getAttribute(
          "data-hx-ext"
        );

      if (value != null) {
        const tokens =
          value
            .split(/[\s,]+/)
            .map(function (token) {
              return token.trim();
            })
            .filter(Boolean);

        if (
          tokens.includes(
            "ignore:" +
              EXTENSION_NAME
          )
        ) {
          return false;
        }

        if (
          tokens.includes(
            EXTENSION_NAME
          )
        ) {
          return true;
        }
      }

      current =
        current.parentElement;
    }

    return null;
  }

  /*
   * ----------------------------------------------------------------
   * Form / controls
   * ----------------------------------------------------------------
   */

  function getRelatedForm(elt) {
    if (
      elt instanceof
      HTMLFormElement
    ) {
      return elt;
    }

    if (
      elt &&
      elt.form instanceof
        HTMLFormElement
    ) {
      return elt.form;
    }

    if (
      elt &&
      typeof elt.closest ===
        "function"
    ) {
      const form =
        elt.closest("form");

      if (
        form instanceof
        HTMLFormElement
      ) {
        return form;
      }
    }

    return null;
  }

  function getControls(root) {
    /*
     * form.elements also includes controls outside
     * the form element that use:
     *
     *   form="form-id"
     */
    if (
      root instanceof
      HTMLFormElement
    ) {
      return Array.from(
        root.elements
      );
    }

    if (
      root &&
      typeof root.querySelectorAll ===
        "function"
    ) {
      return Array.from(
        root.querySelectorAll(
          "[name]"
        )
      );
    }

    return [];
  }

  function indexControlsByName(
    controls
  ) {
    const index =
      new Map();

    for (
      const control of controls
    ) {
      if (!control.name) {
        continue;
      }

      if (
        !index.has(
          control.name
        )
      ) {
        index.set(
          control.name,
          []
        );
      }

      index
        .get(control.name)
        .push(control);
    }

    return index;
  }

  /*
   * ----------------------------------------------------------------
   * Configuration attributes
   * ----------------------------------------------------------------
   */

  function hasConfigAttribute(
    requestElement,
    form,
    name
  ) {
    if (
      hasAttributeInAncestors(
        requestElement,
        name
      )
    ) {
      return true;
    }

    return (
      form !== null &&
      form !== requestElement &&
      hasAttributeInAncestors(
        form,
        name
      )
    );
  }

  function hasAttributeInAncestors(
    start,
    name
  ) {
    let current = start;

    while (
      current instanceof Element
    ) {
      if (
        current.hasAttribute(name)
      ) {
        return true;
      }

      current =
        current.parentElement;
    }

    return false;
  }

  /*
   * ----------------------------------------------------------------
   * FormData -> typed entries
   * ----------------------------------------------------------------
   */

  /**
   * Input:
   *
   *   FormData
   *
   * Output:
   *
   * [
   *   {
   *     name: "name",
   *     value: "John"
   *   },
   *   {
   *     name: "age",
   *     value: 30
   *   }
   * ]
   *
   * DOM and htmx-specific concerns stop here.
   */
  function normalizeEntries(
    parameters,
    context
  ) {
    const entries = [];

    const checkboxGroups =
      getCheckboxGroups(
        context.controls
      );

    const checkboxNames =
      new Set(
        checkboxGroups.keys()
      );

    /*
     * Checkboxes require special handling because
     * unchecked checkboxes are not represented
     * inside FormData.
     */
    for (
      const [
        name,
        group,
      ] of checkboxGroups
    ) {
      const normalizedName =
        name.endsWith("[]")
          ? name.slice(0, -2)
          : name;

      /*
       * Checkbox group.
       */
      if (
        group.length > 1
      ) {
        const values = [];

        for (
          const input of group
        ) {
          if (input.checked) {
            values.push(
              getCheckboxValue(
                input
              )
            );
          } else if (
            context
              .keepFalseCheckboxArray
          ) {
            values.push(false);
          }
        }

        entries.push({
          name:
            normalizedName,

          value:
            values,
        });

        continue;
      }

      /*
       * Single checkbox.
       */
      const input =
        group[0];

      if (input.checked) {
        entries.push({
          name:
            normalizedName,

          value:
            getCheckboxValue(
              input
            ),
        });
      } else if (
        context
          .keepFalseCheckbox
      ) {
        entries.push({
          name:
            normalizedName,

          value:
            false,
        });
      }
    }

    /*
     * Used to associate repeated FormData entries
     * with repeated form controls.
     *
     * Example:
     *
     * <input name="list"
     *        type="number"
     *        value="1">
     *
     * <input name="list"
     *        type="number"
     *        value="2">
     */
    const occurrences =
      new Map();

    if (
      parameters &&
      typeof parameters.entries ===
        "function"
    ) {
      for (
        const [
          name,
          value,
        ] of parameters.entries()
      ) {
        /*
         * Already handled above.
         */
        if (
          checkboxNames.has(
            name
          )
        ) {
          continue;
        }

        const occurrence =
          occurrences.get(
            name
          ) || 0;

        const control =
          getControlForOccurrence(
            context
              .controlsByName,

            name,

            occurrence
          );

        occurrences.set(
          name,
          occurrence + 1
        );

        entries.push({
          name,

          value:
            normalizeValue(
              control,
              value
            ),
        });
      }
    }

    /*
     * FormData stringifies hx-vals.
     *
     * htmx 4 retains the original JS values in
     * ctx.vals specifically for JSON extensions.
     */
    restoreExpressionValues(
      entries,
      context.expressionVars
    );

    return entries;
  }

  /*
   * ----------------------------------------------------------------
   * Checkboxes
   * ----------------------------------------------------------------
   */

  function getCheckboxGroups(
    controls
  ) {
    const groups =
      new Map();

    for (
      const control of controls
    ) {
      if (
        !(
          control instanceof
          HTMLInputElement
        ) ||
        control.type !==
          "checkbox" ||
        !control.name
      ) {
        continue;
      }

      if (
        !groups.has(
          control.name
        )
      ) {
        groups.set(
          control.name,
          []
        );
      }

      groups
        .get(control.name)
        .push(control);
    }

    return groups;
  }

  function getCheckboxValue(
    input
  ) {
    return (
      input.value &&
      input.value !== "on"
    )
      ? input.value
      : true;
  }

  /*
   * ----------------------------------------------------------------
   * Type preservation
   * ----------------------------------------------------------------
   */

  function getControlForOccurrence(
    index,
    name,
    occurrence
  ) {
    const controls =
      index.get(name);

    if (
      !controls ||
      controls.length === 0
    ) {
      return null;
    }

    /*
     * A select[multiple] can produce several
     * FormData entries from one control.
     */
    return controls[
      Math.min(
        occurrence,
        controls.length - 1
      )
    ];
  }

  function normalizeValue(
    control,
    value
  ) {
    if (!control) {
      return value;
    }

    if (
      control.type ===
        "number" ||
      control.type ===
        "range"
    ) {
      return Number(value);
    }

    return value;
  }

  /*
   * ----------------------------------------------------------------
   * hx-vals
   * ----------------------------------------------------------------
   */

  function restoreExpressionValues(
    entries,
    expressionVars
  ) {
    if (
      !expressionVars ||
      typeof expressionVars !==
        "object"
    ) {
      return;
    }

    for (
      const name of
        Object.keys(
          expressionVars
        )
    ) {
      let firstIndex = -1;

      /*
       * htmx applies hx-vals using FormData.set(),
       * so an hx-vals value overrides previous
       * values using the same key.
       */
      for (
        let i =
          entries.length - 1;

        i >= 0;

        i--
      ) {
        if (
          entries[i].name !==
          name
        ) {
          continue;
        }

        firstIndex = i;

        entries.splice(
          i,
          1
        );
      }

      const restored = {
        name,

        value:
          expressionVars[name],
      };

      if (
        firstIndex === -1
      ) {
        entries.push(
          restored
        );
      } else {
        entries.splice(
          firstIndex,
          0,
          restored
        );
      }
    }
  }

  /*
   * ----------------------------------------------------------------
   * Flat encoding
   * ----------------------------------------------------------------
   */

  function encodeFlat(entries) {
    const result =
      createObject();

    for (
      const entry of entries
    ) {
      setFlatValue(
        result,
        entry.name,
        entry.value
      );
    }

    return result;
  }

  function setFlatValue(
    result,
    name,
    value
  ) {
    const current =
      getOwn(
        result,
        name
      );

    if (
      current === undefined
    ) {
      setOwn(
        result,
        name,
        value
      );

      return;
    }

    if (
      Array.isArray(current)
    ) {
      current.push(value);
      return;
    }

    setOwn(
      result,
      name,
      [
        current,
        value,
      ]
    );
  }

  /*
   * ----------------------------------------------------------------
   * Nested encoding
   * ----------------------------------------------------------------
   */

  function encodeNested(
    entries
  ) {
    const result =
      createObject();

    for (
      const entry of entries
    ) {
      const steps =
        parsePath(
          entry.name
        );

      setPathValue(
        result,
        steps,
        entry.value
      );
    }

    return result;
  }

  /*
   * ----------------------------------------------------------------
   * Path parser
   * ----------------------------------------------------------------
   */

  /**
   * Supports W3C bracket notation:
   *
   *   pet[name]
   *
   *   data[person][2][name]
   *
   * plus historical form-json dot notation:
   *
   *   pet.name
   *
   *   data.person[2].name
   *
   * append:
   *
   *   highlander[]
   *
   * Invalid syntax becomes a literal property name.
   */
  function parsePath(name) {
    const original = name;

    const steps = [];

    let i = 0;

    const first =
      readUntil(
        name,
        i,
        ["[", "."]
      );

    if (!first.value) {
      return literalPath(
        original
      );
    }

    steps.push({
      type:
        "object",

      key:
        first.value,

      append:
        false,

      last:
        false,

      nextType:
        null,
    });

    i = first.next;

    while (
      i < name.length
    ) {
      /*
       * Dot notation.
       */
      if (
        name[i] === "."
      ) {
        i++;

        const part =
          readUntil(
            name,
            i,
            ["[", "."]
          );

        if (!part.value) {
          return literalPath(
            original
          );
        }

        const numeric =
          isDigits(
            part.value
          );

        steps.push({
          type:
            numeric
              ? "array"
              : "object",

          key:
            numeric
              ? Number(
                  part.value
                )
              : part.value,

          append:
            false,

          last:
            false,

          nextType:
            null,
        });

        i = part.next;

        continue;
      }

      /*
       * Bracket notation.
       */
      if (
        name[i] !== "["
      ) {
        return literalPath(
          original
        );
      }

      const end =
        name.indexOf(
          "]",
          i + 1
        );

      if (
        end === -1
      ) {
        return literalPath(
          original
        );
      }

      const part =
        name.slice(
          i + 1,
          end
        );

      /*
       * Append notation:
       *
       *   field[]
       *
       * may only appear at the end.
       */
      if (part === "") {
        if (
          end !==
            name.length - 1 ||
          steps.length === 0
        ) {
          return literalPath(
            original
          );
        }

        steps[
          steps.length - 1
        ].append = true;

        i = end + 1;

        continue;
      }

      const numeric =
        isDigits(part);

      steps.push({
        type:
          numeric
            ? "array"
            : "object",

        key:
          numeric
            ? Number(part)
            : part,

        append:
          false,

        last:
          false,

        nextType:
          null,
      });

      i = end + 1;
    }

    if (
      steps.length === 0
    ) {
      return literalPath(
        original
      );
    }

    /*
     * Decorate steps with last/nextType so the
     * merge engine doesn't need to inspect the
     * rest of the path.
     */
    for (
      let index = 0;

      index <
      steps.length;

      index++
    ) {
      const step =
        steps[index];

      step.last =
        index ===
        steps.length - 1;

      step.nextType =
        step.last
          ? null
          : steps[
              index + 1
            ].type;
    }

    return steps;
  }

  function readUntil(
    input,
    start,
    delimiters
  ) {
    let end = start;

    while (
      end < input.length &&
      !delimiters.includes(
        input[end]
      )
    ) {
      end++;
    }

    return {
      value:
        input.slice(
          start,
          end
        ),

      next:
        end,
    };
  }

  function literalPath(name) {
    return [
      {
        type:
          "object",

        key:
          name,

        append:
          false,

        last:
          true,

        nextType:
          null,
      },
    ];
  }

  function isDigits(value) {
    return /^\d+$/.test(
      value
    );
  }

  /*
   * ----------------------------------------------------------------
   * JSON merge algorithm
   * ----------------------------------------------------------------
   */

  /**
   * Values are inserted sequentially.
   *
   * This preserves:
   *
   * - repeated scalar values
   * - sparse arrays
   * - scalar/object collisions
   * - array/object collisions
   * - append notation
   */
  function setPathValue(
    root,
    steps,
    entryValue
  ) {
    let context = root;

    for (
      const step of steps
    ) {
      const currentValue =
        getOwn(
          context,
          step.key
        );

      context =
        setJSONValue(
          context,
          step,
          currentValue,
          entryValue
        );
    }
  }

  function setJSONValue(
    context,
    step,
    currentValue,
    entryValue
  ) {
    /*
     * Leaf.
     */
    if (step.last) {
      /*
       * First value.
       */
      if (
        currentValue ===
        undefined
      ) {
        setOwn(
          context,
          step.key,

          step.append
            ? [entryValue]
            : entryValue
        );

        return context;
      }

      /*
       * Repeated scalar path:
       *
       * list=1
       * list=2
       * list=3
       *
       * ->
       *
       * list: [1, 2, 3]
       */
      if (
        Array.isArray(
          currentValue
        )
      ) {
        currentValue.push(
          entryValue
        );

        return context;
      }

      /*
       * Scalar colliding with an existing object:
       *
       * mix.key=value
       * mix=scalar
       *
       * ->
       *
       * mix: {
       *   key: "value",
       *   "": "scalar"
       * }
       */
      if (
        isObject(
          currentValue
        )
      ) {
        const emptyStep = {
          type:
            "object",

          key:
            "",

          append:
            false,

          last:
            true,

          nextType:
            null,
        };

        return setJSONValue(
          currentValue,

          emptyStep,

          getOwn(
            currentValue,
            ""
          ),

          entryValue
        );
      }

      /*
       * Second scalar value.
       */
      setOwn(
        context,

        step.key,

        [
          currentValue,
          entryValue,
        ]
      );

      return context;
    }

    /*
     * Intermediate path does not exist yet.
     */
    if (
      currentValue ===
      undefined
    ) {
      const child =
        step.nextType ===
        "array"
          ? []
          : createObject();

      setOwn(
        context,
        step.key,
        child
      );

      return child;
    }

    /*
     * Existing object.
     */
    if (
      isObject(
        currentValue
      )
    ) {
      return currentValue;
    }

    /*
     * Existing array.
     */
    if (
      Array.isArray(
        currentValue
      )
    ) {
      /*
       * Array continues into another array index.
       */
      if (
        step.nextType ===
        "array"
      ) {
        return currentValue;
      }

      /*
       * Array/object conflict:
       *
       * ["A", null, "C"]
       *
       * ->
       *
       * {
       *   "0": "A",
       *   "2": "C"
       * }
       */
      const child =
        arrayToObject(
          currentValue
        );

      setOwn(
        context,
        step.key,
        child
      );

      return child;
    }

    /*
     * Scalar/container conflict.
     *
     * Preserve the scalar using the empty-string key.
     */
    const child =
      createObject();

    setOwn(
      child,
      "",
      currentValue
    );

    setOwn(
      context,
      step.key,
      child
    );

    return child;
  }

  /*
   * ----------------------------------------------------------------
   * Helpers
   * ----------------------------------------------------------------
   */

  function arrayToObject(
    array
  ) {
    const object =
      createObject();

    for (
      let i = 0;

      i < array.length;

      i++
    ) {
      if (
        Object.prototype
          .hasOwnProperty
          .call(
            array,
            i
          )
      ) {
        setOwn(
          object,
          String(i),
          array[i]
        );
      }
    }

    return object;
  }

  /*
   * Null-prototype objects prevent form names such as
   * __proto__ from mutating Object.prototype.
   */
  function createObject() {
    return Object.create(null);
  }

  function isObject(value) {
    return (
      value !== null &&
      typeof value ===
        "object" &&
      !Array.isArray(value)
    );
  }

  function getOwn(
    object,
    key
  ) {
    return Object.prototype
      .hasOwnProperty
      .call(
        object,
        key
      )
      ? object[key]
      : undefined;
  }

  /*
   * defineProperty is used instead of direct assignment
   * so keys such as "__proto__" remain ordinary JSON keys.
   */
  function setOwn(
    object,
    key,
    value
  ) {
    Object.defineProperty(
      object,
      key,
      {
        value,

        writable:
          true,

        enumerable:
          true,

        configurable:
          true,
      }
    );
  }
})();