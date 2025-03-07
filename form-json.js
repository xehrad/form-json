(function() {
  let api
  const _ConfigIgnoreDeepKey_ = 'ignore-deep-key'
  const _FlagObject_ = 'obj'
  const _FlagArray_  = 'arr'
  const _FlagValue_  = 'val'

  htmx.defineExtension('form-json', {
    init: function(apiRef) {
      api = apiRef
    },

    onEvent: function(name, evt) {
      if (name === 'htmx:configRequest') {
        evt.detail.headers['Content-Type'] = 'application/json'
      }
    },

    encodeParameters: function(xhr, parameters, elt) {
      let object = {}
      xhr.overrideMimeType('text/json')

      for (const [key, value] of parameters.entries()) {
        const input = elt.querySelector(`[name="${key}"]`)
        const transformedValue = input ? convertValue(input, value, input.type) : value
        if (Object.hasOwn(object, key)) {
          if (!Array.isArray(object[key])) {
            object[key] = [object[key]]
          }
          object[key].push(transformedValue)
        } else {
          object[key] = transformedValue
        }
      }

      // FormData encodes values as strings, restore hx-vals/hx-vars with their initial types
      const vals = api.getExpressionVars(elt)
      Object.keys(object).forEach(function(key) {
        object[key] = Object.hasOwn(vals, key) ? vals[key] : object[key]
      })

      if(!api.hasAttribute(elt, _ConfigIgnoreDeepKey_)){
        const flagMap = getFlagMap(object)
        object = buildNestedObject(flagMap, object)
      }
      return (JSON.stringify(object))
    }
  })

  function convertValue(input, value, inputType) {
    if (inputType == 'number' || inputType == 'range') {
      return Array.isArray(value) ? value.map(Number) : Number(value)
    } else if (inputType === 'checkbox') {
      return input.defaultValue || true
    } /*else if (inputType === 'file') {
      return handleFileInput(input)
    }*/
    return value
  }

  function handleFileInput(input) {
    return new Promise((resolve) => {
      const file = input.files[0]
      const reader = new FileReader()
      reader.onloadend = function() {
        // Since it contains the Data URI, we should remove the prefix and keep only Base64 string
        resolve({
          'body': reader.result.replace(/^data:.+;base64,/, ''),
          'type': file.type,
          'name': file.name,
        })
      }
      reader.readAsDataURL(file)
    })
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
            const path = parts.slice(0, i+1).join('.')
            const isLastPart = i === parts.length - 1
            const nextIsNumeric = !isLastPart && !isNaN(Number(parts[i + 1]))

            if (isLastPart) {
                    flagMap[path]= _FlagValue_
            } else {
                if (!flagMap.hasOwnProperty(path)) {
                    flagMap[path] = nextIsNumeric ? _FlagArray_ : _FlagObject_
                }else if(flagMap[path]===_FlagValue_ || !nextIsNumeric){
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

            if (isLastPart){
                if (flagMap[path] === _FlagObject_){
                    current[part] = { '': map[key] }
                } else if (part === '-1'){
                  const val = map[key]
                  Array.isArray(val) ? current.push(...val) : current.push(val)
                } else {
                  current[part] = map[key]
                }    
            } else if(!current.hasOwnProperty(part)) {
                current[part] = flagMap[path] === _FlagArray_ ? [] : {}
            }
            
            current = current[part]
        })
      }
      return out
  }
})()