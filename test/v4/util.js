/* Test Utilities */

function byId(id) {
  return document.getElementById(id)
}

function make(htmlStr) {
  htmlStr = htmlStr.trim()
  var makeFn = function () {
    var range = document.createRange()
    var fragment = range.createContextualFragment(htmlStr)
    var wa = getWorkArea()
    var child = null
    var children = fragment.children || fragment.childNodes // IE
    var appendedChildren = []
    while (children.length > 0) {
      child = children[0]
      wa.appendChild(child)
      appendedChildren.push(child)
    }
    for (var i = 0; i < appendedChildren.length; i++) {
      htmx.process(appendedChildren[i])
    }
    return child // return last added element
  }
  if (getWorkArea()) {
    return makeFn()
  } else {
    ready(makeFn)
  }
}

function ready(fn) {
  if (document.readyState !== 'loading') {
    fn()
  } else {
    document.addEventListener('DOMContentLoaded', fn)
  }
}

function getWorkArea() {
  return byId('work-area')
}

function clearWorkArea() {
  var workArea = getWorkArea()
  if (workArea) workArea.innerHTML = ''
}

function removeWhiteSpace(str) {
  return str.replace(/\s/g, '')
}

function getHTTPMethod(xhr) {
  return xhr.requestHeaders['X-HTTP-Method-Override'] || xhr.method
}

function parseParams(str) {
  var re = /([^&=]+)=?([^&]*)/g
  var decode = function (str) {
    return decodeURIComponent(str.replace(/\+/g, ' '))
  }
  var params = {}; var e
  if (str) {
    if (str.substr(0, 1) == '?') {
      str = str.substr(1)
    }
    while (e = re.exec(str)) {
      var k = decode(e[1])
      var v = decode(e[2])
      if (params[k] !== undefined) {
        if (!Array.isArray(params[k])) {
          params[k] = [params[k]]
        }
        params[k].push(v)
      } else {
        params[k] = v
      }
    }
  }
  return params
}

function getQuery(url) {
  var question = url.indexOf('?')
  var hash = url.indexOf('#')
  if (hash == -1 && question == -1) return ''
  if (hash == -1) hash = url.length
  return question == -1 || hash == question + 1
    ? url.substring(hash)
    : url.substring(question + 1, hash)
}

function getParameters(xhr) {
  if (getHTTPMethod(xhr) == 'GET') {
    return parseParams(getQuery(xhr.url))
  } else {
    return parseParams(xhr.requestBody)
  }
}

function log(val) {
  console.log(val)
  return val
}

function makeServer() {
  var routes = []
  var pending = []
  var pendingWaiters = []
  var restored = false

  var server = {
    lastRequest: undefined,

    respondWith: function (method, url, handler) {
      routes.push({
        method: method.toUpperCase(),
        url: url,
        handler: handler
      })
    },

    respond: async function () {
      var pendingRequest = await nextPendingRequest()

      var request = pendingRequest.request
      var ctx = pendingRequest.ctx

      var route = findRoute(request)

      if (!route) {
        var error = new Error(
          'No fake response configured for ' +
          request.method +
          ' ' +
          request.url
        )

        pendingRequest.reject(error)
        throw error
      }

      var status = 200
      var headers = {}
      var body = ''
      var hasResponded = false

      request.respond = function (
        responseStatus,
        responseHeaders,
        responseBody
      ) {
        status = responseStatus
        headers = responseHeaders || {}
        body = responseBody == null
          ? ''
          : String(responseBody)

        hasResponded = true
      }

      try {
        if (typeof route.handler === 'function') {
          route.handler(request)
        } else {
          body = route.handler == null
            ? ''
            : String(route.handler)

          hasResponded = true
        }
      } catch (error) {
        pendingRequest.reject(error)
        throw error
      }

      if (!hasResponded) {
        body = ''
      }

      request.response = body
      request.status = status
      request.responseHeaders = headers

      var completion =
        waitForRequestCompletion(ctx)

      var response = new Response(
        body,
        {
          status: status,
          headers: headers
        }
      )

      /*
       * Native Response created in tests has no real network URL.
       * Give htmx a sensible URL for response processing.
       */
      try {
        Object.defineProperty(
          response,
          'url',
          {
            value: new URL(
              request.url,
              window.location.href
            ).href
          }
        )
      } catch (_) {
        // Response.url is not important for these tests.
      }

      pendingRequest.resolve(response)

      /*
       * HTMX 4 is asynchronous.
       * Wait until the complete request/swap lifecycle finishes.
       */
      await completion
    },

    restore: function () {
      if (restored) {
        return
      }

      restored = true

      document.removeEventListener(
        'htmx:config:request',
        onConfigRequest
      )
    }
  }

  function onConfigRequest(evt) {
    var ctx = evt.detail.ctx

    /*
     * HTMX 4 allows replacing fetch for an individual request.
     */
    ctx.fetch = function (input, init) {
      init = init || {}

      var request = {
        method: String(
          init.method || 'GET'
        ).toUpperCase(),

        url:
          typeof input === 'string'
            ? input
            : input.url,

        requestBody:
          init.body == null
            ? null
            : init.body,

        requestHeaders:
          normalizeHeaders(
            init.headers
          ),

        response: undefined,
        status: undefined,
        responseHeaders: undefined
      }

      server.lastRequest = request

      return new Promise(function (
        resolve,
        reject
      ) {
        var item = {
          ctx: ctx,
          request: request,
          resolve: resolve,
          reject: reject
        }

        if (
          pendingWaiters.length > 0
        ) {
          pendingWaiters
            .shift()(item)
        } else {
          pending.push(item)
        }
      })
    }
  }

  function nextPendingRequest() {
    if (pending.length > 0) {
      return Promise.resolve(
        pending.shift()
      )
    }

    return new Promise(function (
      resolve
    ) {
      pendingWaiters.push(
        resolve
      )
    })
  }

  function findRoute(request) {
    var requestURL =
      normalizeURL(request.url)

    for (
      var i = 0;
      i < routes.length;
      i++
    ) {
      var route = routes[i]

      if (
        route.method ===
        request.method &&
        normalizeURL(route.url) ===
        requestURL
      ) {
        return route
      }
    }

    return null
  }

  function normalizeURL(url) {
    try {
      var parsed =
        new URL(
          url,
          window.location.href
        )

      /*
       * Ignore query parameters for matching
       * respondWith('/test'), like the previous
       * test suite expected.
       */
      return parsed.pathname
    } catch (_) {
      return url.split('?')[0]
    }
  }

  function normalizeHeaders(headers) {
    var result = {}

    if (!headers) {
      return result
    }

    if (
      headers instanceof Headers
    ) {
      headers.forEach(
        function (value, key) {
          result[key] = value
        }
      )

      return result
    }

    if (Array.isArray(headers)) {
      headers.forEach(
        function (pair) {
          result[pair[0]] =
            pair[1]
        }
      )

      return result
    }

    Object.keys(headers)
      .forEach(function (key) {
        result[key] =
          headers[key]
      })

    return result
  }

  function waitForRequestCompletion(ctx) {
    return new Promise(function (
      resolve
    ) {
      var handler = function (evt) {
        if (
          evt.detail.ctx !== ctx
        ) {
          return
        }

        document.removeEventListener(
          'htmx:finally:request',
          handler
        )

        resolve()
      }

      document.addEventListener(
        'htmx:finally:request',
        handler
      )
    })
  }

  document.addEventListener(
    'htmx:config:request',
    onConfigRequest
  )

  return server
}