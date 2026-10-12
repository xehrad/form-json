import htmx from 'htmx.org'

let api

const _ConfigIgnoreDeepKey_ = 'ignore-deep-key'
const _ConfigIgnoreDropFalseOption_ = 'ignore-drop-false-option'
const _ConfigIgnoreDropFalseOptionArray_ = 'ignore-drop-false-option-array'

const _FlagObject_ = 'obj'
const _FlagArray_ = 'arr'
const _FlagValue_ = 'val'


htmx.defineExtension('form-json', {
  init: function (apiRef) {
    api = apiRef
  },

  onEvent: function (name, evt) {
    if (name === 'htmx:configRequest') {
      evt.detail.headers['Content-Type'] = 'application/json'
    }
  },

  encodeParameters: function (xhr, parameters, elt) {
    const requestElt = elt
    const fieldRoot = getFieldRoot(elt)

    let object = {}

    xhr.overrideMimeType('application/json')

    // --- Handle checkboxes manually ---
    const checkboxGroups = getCheckboxGroups(fieldRoot)

    checkboxGroups.forEach((group, name) => {
      const key = name.endsWith('[]')
        ? name.slice(0, -2)
        : name

      // Multiple checkboxes => array of checked values
      if (group.length > 1) {
        object[key] = []

        group.forEach(input => {
          if (input.checked) {
            const value =
              input.value && input.value !== 'on'
                ? input.value
                : true

            object[key].push(value)
          } else if (
            hasConfigAttribute(
              requestElt,
              fieldRoot,
              _ConfigIgnoreDropFalseOptionArray_
            )
          ) {
            object[key].push(false)
          }
        })

        return
      }

      // Single checkbox => true/false or value/false
      const input = group[0]

      if (input.checked) {
        object[key] =
          input.value && input.value !== 'on'
            ? input.value
            : true
      } else if (
        hasConfigAttribute(
          requestElt,
          fieldRoot,
          _ConfigIgnoreDropFalseOption_
        )
      ) {
        object[key] = false
      }
    })

    // --- Handle all other fields via FormData ---
    for (const [key, value] of parameters.entries()) {
      const input = findField(fieldRoot, key)

      // Checkboxes are already handled above.
      if (input && input.type === 'checkbox') {
        continue
      }

      const transformedValue = input
        ? convertValue(input, value)
        : value

      if (Object.prototype.hasOwnProperty.call(object, key)) {
        if (!Array.isArray(object[key])) {
          object[key] = [object[key]]
        }

        object[key].push(transformedValue)
      } else {
        object[key] = transformedValue
      }
    }

    /*
     * Restore hx-vals / hx-vars values.
     *
     * Important:
     * Use the original HTMX request element here, not fieldRoot.
     *
     * For example:
     *
     * <form>
     *   <button
     *     hx-post="/save"
     *     hx-vals='{"price": 10}'>
     *   </button>
     * </form>
     *
     * Replacing requestElt with the form would lose values defined
     * directly on the triggering element.
     */
    const vals = api.getExpressionVars(requestElt)

    Object.keys(object).forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(vals, key)) {
        object[key] = vals[key]
      }
    })

    // --- Build nested objects unless disabled ---
    if (
      !hasConfigAttribute(
        requestElt,
        fieldRoot,
        _ConfigIgnoreDeepKey_
      )
    ) {
      const flagMap = getFlagMap(object)
      object = buildNestedObject(flagMap, object)
    }

    return JSON.stringify(object)
  }
})

/**
 * Determine where form fields should be looked up.
 *
 * HTMX may call encodeParameters with a button/input/div/etc.
 * even though the submitted parameters belong to an associated form.
 */
function getFieldRoot(elt) {
  if (elt instanceof HTMLFormElement) {
    return elt
  }

  // Handles form-associated elements such as:
  //
  // <button form="my-form">
  // <input form="my-form">
  // <fieldset>
  //
  if (elt.form instanceof HTMLFormElement) {
    return elt.form
  }

  // Handles non-form-associated elements inside a form:
  //
  // <form>
  //   <div hx-post="/save">
  // </form>
  //
  if (typeof elt.closest === 'function') {
    const form = elt.closest('form')

    if (form instanceof HTMLFormElement) {
      return form
    }
  }

  // Preserve the previous behavior when no form exists.
  return elt
}

/**
 * Find a field by its exact name.
 *
 * When root is a form, use form.elements instead of querySelector().
 * This also supports controls located outside the form but associated
 * using the HTML `form` attribute.
 *
 * Example:
 *
 * <form id="edit"></form>
 *
 * <input
 *   form="edit"
 *   name="Price"
 *   type="number">
 */
function findField(root, name) {
  const fields = getFields(root)

  for (const field of fields) {
    if (field.name === name) {
      return field
    }
  }

  return null
}

/**
 * Return form controls belonging to the field root.
 */
function getFields(root) {
  if (root instanceof HTMLFormElement) {
    return Array.from(root.elements)
  }

  if (typeof root.querySelectorAll === 'function') {
    return Array.from(root.querySelectorAll('[name]'))
  }

  return []
}

/**
 * Group checkboxes by their exact HTML name.
 *
 * Example:
 *
 * roles[]
 * roles[]
 *
 * becomes:
 *
 * Map {
 *   "roles[]" => [checkbox1, checkbox2]
 * }
 */
function getCheckboxGroups(root) {
  const groups = new Map()

  for (const field of getFields(root)) {
    if (
      !(field instanceof HTMLInputElement) ||
      field.type !== 'checkbox' ||
      !field.name
    ) {
      continue
    }

    if (!groups.has(field.name)) {
      groups.set(field.name, [])
    }

    groups.get(field.name).push(field)
  }

  return groups
}

/**
 * Extension configuration may be defined either on:
 *
 * - the HTMX request element
 * - the associated form
 *
 * This matters when hx-post is placed on a button but form-json
 * configuration lives on the form.
 */
function hasConfigAttribute(requestElt, fieldRoot, name) {
  if (api.hasAttribute(requestElt, name)) {
    return true
  }

  return (
    fieldRoot !== requestElt &&
    api.hasAttribute(fieldRoot, name)
  )
}

/**
 * Convert values according to their HTML input type.
 */
function convertValue(input, value) {
  if (
    input.type === 'number' ||
    input.type === 'range'
  ) {
    return Array.isArray(value)
      ? value.map(Number)
      : Number(value)
  }

  return value
}

function splitKey(key) {
  // Convert:
  // a.b[]  => a.b[-1]
  // a.b[c] => ['a', 'b', 'c']
  return key
    .replace(/\[\s*\]/g, '[-1]')
    .replace(/\]/g, '')
    .split(/\[|\./)
}

function getFlagMap(map) {
  const flagMap = {}

  for (const key in map) {
    const parts = splitKey(key)

    parts.forEach((_, i) => {
      const path = parts
        .slice(0, i + 1)
        .join('.')

      const isLastPart =
        i === parts.length - 1

      const nextIsNumeric =
        !isLastPart &&
        !isNaN(Number(parts[i + 1]))

      if (isLastPart) {
        flagMap[path] = _FlagValue_
        return
      }

      if (
        !Object.prototype.hasOwnProperty.call(
          flagMap,
          path
        )
      ) {
        flagMap[path] = nextIsNumeric
          ? _FlagArray_
          : _FlagObject_
      } else if (
        flagMap[path] === _FlagValue_ ||
        !nextIsNumeric
      ) {
        flagMap[path] = _FlagObject_
      }
    })
  }

  return flagMap
}

function buildNestedObject(flagMap, map) {
  const out = {}

  for (const key in map) {
    const parts = splitKey(key)

    let current = out

    parts.forEach((part, i) => {
      const path = parts
        .slice(0, i + 1)
        .join('.')

      const isLastPart =
        i === parts.length - 1

      if (isLastPart) {
        if (flagMap[path] === _FlagObject_) {
          current[part] = {
            '': map[key]
          }
        } else if (part === '-1') {
          const value = map[key]

          if (Array.isArray(value)) {
            current.push(...value)
          } else {
            current.push(value)
          }
        } else {
          current[part] = map[key]
        }

        return
      }

      if (
        !Object.prototype.hasOwnProperty.call(
          current,
          part
        )
      ) {
        current[part] =
          flagMap[path] === _FlagArray_
            ? []
            : {}
      }

      current = current[part]
    })
  }

  return out
}

export default htmx