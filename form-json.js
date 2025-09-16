(function () {
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
      let object = {}
      xhr.overrideMimeType('application/json')

      // --- Handle checkboxes manually ---
      elt.querySelectorAll('input[type="checkbox"]').forEach(input => {
        if (!input.name) return
        const key = input.name.endsWith("[]") ? input.name.slice(0, -2) : input.name
        const group = elt.querySelectorAll(`input[name="${input.name}"]`)

        // Multiple checkboxes → array of checked values
        if (group.length > 1) {
          if (!object[key]) object[key] = []
          if (input.checked) {
            const val = input.value && input.value !== "on" ? input.value : true
            object[key].push(val)
          } else if (api.hasAttribute(elt, _ConfigIgnoreDropFalseOptionArray_)) {
            object[key].push(false)
          }
        } else {
          // Single checkbox → true/false or value/false
          if (input.checked) {
            object[key] = input.value && input.value !== "on" ? input.value : true
          } else if (api.hasAttribute(elt, _ConfigIgnoreDropFalseOption_)) {
            object[key] = false
          }
        }
      })

      // --- Handle all other fields via FormData ---
      for (const [key, value] of parameters.entries()) {
        const input = elt.querySelector(`[name="${key}"]`)
        if (input && input.type === "checkbox") continue // skip checkboxes

        const transformedValue = input ? convertValue(input, value, input.type) : value
        if (Object.prototype.hasOwnProperty.call(object, key)) {
          if (!Array.isArray(object[key])) {
            object[key] = [object[key]]
          }
          object[key].push(transformedValue)
        } else {
          object[key] = transformedValue
        }
      }

      // Restore hx-vals / hx-vars
      const vals = api.getExpressionVars(elt)
      Object.keys(object).forEach(function (key) {
        object[key] = Object.prototype.hasOwnProperty.call(vals, key) ? vals[key] : object[key]
      })

      // Build nested objects unless disabled
      if (!api.hasAttribute(elt, _ConfigIgnoreDeepKey_)) {
        const flagMap = getFlagMap(object)
        object = buildNestedObject(flagMap, object)
      }
      return JSON.stringify(object)
    }
  })

  function convertValue(input, value, inputType) {
    if (inputType === 'number' || inputType === 'range') {
      return Array.isArray(value) ? value.map(Number) : Number(value)
    }
    return value
  }

  function splitKey(key) {
    // Convert 'a.b[]'  to a.b[-1]
    // and     'a.b[c]' to ['a', 'b', 'c']
    return key.replace(/\[\s*\]/g, '[-1]').replace(/\]/g, '').split(/\[|\./)
  }

  function getFlagMap(map) {
    const flagMap = {}
    for (const key in map) {
      const parts = splitKey(key)
      parts.forEach((part, i) => {
        const path = parts.slice(0, i + 1).join('.')
        const isLastPart = i === parts.length - 1
        const nextIsNumeric = !isLastPart && !isNaN(Number(parts[i + 1]))

        if (isLastPart) {
          flagMap[path] = _FlagValue_
        } else {
          if (!flagMap.hasOwnProperty(path)) {
            flagMap[path] = nextIsNumeric ? _FlagArray_ : _FlagObject_
          } else if (flagMap[path] === _FlagValue_ || !nextIsNumeric) {
            flagMap[path] = _FlagObject_
          }
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
        const path = parts.slice(0, i + 1).join('.')
        const isLastPart = i === parts.length - 1
        if (isLastPart) {
          if (flagMap[path] === _FlagObject_) {
            current[part] = { '': map[key] }
          } else if (part === '-1') {
            const val = map[key]
            Array.isArray(val) ? current.push(...val) : current.push(val)
          } else {
            current[part] = map[key]
          }
        } else if (!current.hasOwnProperty(part)) {
          current[part] = flagMap[path] === _FlagArray_ ? [] : {}
        }
        current = current[part]
      })
    }
    return out
  }
})()