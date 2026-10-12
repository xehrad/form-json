describe('form-json extension', async function () {
  beforeEach(function () {
    this.server = makeServer()
    clearWorkArea()
  })
  afterEach(function () {
    this.server.restore()
    clearWorkArea()
  })

  it('handles basic GET properly', async function () {
    var jsonResponseBody = JSON.stringify({})
    this.server.respondWith('GET', '/test', jsonResponseBody)
    var div = make('<div hx-get="/test" hx-ext="form-json">click me</div>')
    div.click()
    await this.server.respond()
    this.server.lastRequest.response.should.equal('{}')
  })

  it('handles basic POST properly', async function () {
    var jsonResponseBody = JSON.stringify({})
    this.server.respondWith('POST', '/test', jsonResponseBody)
    var div = make("<div hx-post='/test' hx-ext='form-json'>click me</div>")
    div.click()
    await this.server.respond()
    this.server.lastRequest.response.should.equal('{}')
  })

  it('handles basic PUT properly', async function () {
    var jsonResponseBody = JSON.stringify({})
    this.server.respondWith('PUT', '/test', jsonResponseBody)
    var div = make('<div hx-put="/test" hx-ext="form-json">click me</div>')
    div.click()
    await this.server.respond()
    this.server.lastRequest.response.should.equal('{}')
  })

  it('handles basic PATCH properly', async function () {
    var jsonResponseBody = JSON.stringify({})
    this.server.respondWith('PATCH', '/test', jsonResponseBody)
    var div = make('<div hx-patch="/test" hx-ext="form-json">click me</div>')
    div.click()
    await this.server.respond()
    this.server.lastRequest.response.should.equal('{}')
  })

  it('handles basic DELETE properly', async function () {
    var jsonResponseBody = JSON.stringify({})
    this.server.respondWith('DELETE', '/test', jsonResponseBody)
    var div = make('<div hx-delete="/test" hx-ext="form-json">click me</div>')
    div.click()
    await this.server.respond()
    this.server.lastRequest.response.should.equal('{}')
  })

  it('handles POST with form parameters', async function () {
    this.server.respondWith('POST', '/test', function (xhr) {
      var values = JSON.parse(xhr.requestBody)
      values.should.have.keys('username', 'password')
      values.username.should.be.equal('joe')
      values.password.should.be.equal('123456')
      var ans = { password_ok: values.password == '123456' }
      xhr.respond(200, {}, JSON.stringify(ans))
    })

    var html = make(`
      <form hx-post="/test" hx-ext="form-json" >
        <input type="text"  name="username" value="joe">
        <input type="password"  name="password" value="123456">
        <button  id="btnSubmit">Submit</button>
      </form>`)

    byId('btnSubmit').click()
    await this.server.respond()
    this.server.lastRequest.response.should.equal('{"password_ok":true}')
  })

  it('handles PUT with form parameters', async function () {
    this.server.respondWith('PUT', '/test', function (xhr) {
      var values = JSON.parse(xhr.requestBody)
      values.should.have.keys('username', 'password')
      values.username.should.be.equal('joe')
      values.password.should.be.equal('123456')
      var ans = { password_ok: values.password == '123456' }
      xhr.respond(200, {}, JSON.stringify(ans))
    })

    var html = make(`
      <form hx-put="/test" hx-ext="form-json" >
        <input type="text"  name="username" value="joe">
        <input type="password"  name="password" value="123456">
        <button  id="btnSubmit">Submit</button>
      </form>`)

    byId('btnSubmit').click()
    await this.server.respond()
    this.server.lastRequest.response.should.equal('{"password_ok":true}')
  })

  it('handles PATCH with form parameters', async function () {
    this.server.respondWith('PATCH', '/test', function (xhr) {
      var values = JSON.parse(xhr.requestBody)
      values.should.have.keys('username', 'password')
      values.username.should.be.equal('joe')
      values.password.should.be.equal('123456')
      var ans = { password_ok: values.password == '123456' }
      xhr.respond(200, {}, JSON.stringify(ans))
    })

    var html = make(`
      <form hx-patch="/test" hx-ext="form-json" >
        <input type="text"  name="username" value="joe">
        <input type="password"  name="password" value="123456">
        <button  id="btnSubmit">Submit</button>
      </form>`)

    byId('btnSubmit').click()
    await this.server.respond()
    this.server.lastRequest.response.should.equal('{"password_ok":true}')
  })

  it('handles DELETE with form parameters', async function () {
    const defaults = htmx.config.methodsThatUseUrlParams
    htmx.config.methodsThatUseUrlParams = ['get']
    this.server.respondWith('DELETE', '/test', function (xhr) {
      var values = JSON.parse(xhr.requestBody)
      values.should.have.keys('username', 'password')
      values.username.should.be.equal('joe')
      values.password.should.be.equal('123456')
      var ans = { password_ok: values.password == '123456' }
      xhr.respond(200, {}, JSON.stringify(ans))
    })

    var html = make(`
      <form hx-delete="/test" hx-ext="form-json" >
        <input type="text"  name="username" value="joe">
        <input type="password"  name="password" value="123456">
        <button  id="btnSubmit">Submit</button>
      </form>`)

    byId('btnSubmit').click()
    await this.server.respond()
    this.server.lastRequest.response.should.equal('{"password_ok":true}')
    htmx.config.methodsThatUseUrlParams = defaults
  })

  it('handles hx-vals properly', async function () {
    this.server.respondWith('POST', '/test', function (xhr) {
      var values = JSON.parse(xhr.requestBody)
      values.number.should.equal(5000)
      values.numberString.should.equal('5000')
      chai.assert.deepEqual(values.obj, { 'x': 123 })
      chai.assert.deepEqual(values.array, ['text', 123, { 'key': 'value' }])
      xhr.respond(200, {}, 'clicked')
    })

    make(`
      <form 
        hx-ext="form-json" 
        hx-post="/test" 
        hx-vals="js:{'obj': {'x': 123}, 'number': 5000, 'numberString': '5000', 'array': ['text', 123, {'key': 'value'}]}">
             <button id="btnSubmit" type="submit">Submit</button>
          </form>`)

    byId('btnSubmit').click()
    await this.server.respond()
  })

  it('handles hidden value', async function () {
    this.server.respondWith('POST', '/test', function (xhr) {
      var values = JSON.parse(xhr.requestBody)
      values.should.have.keys('foo', 'customValue', 'boolean')
      values.foo.should.equal("bar")
      values.customValue.should.equal(87)
      values.boolean.should.equal(true)
      xhr.respond(200, {}, 'clicked')
    })

    make(`
      <form 
        hx-ext="form-json" 
        hx-post="/test" 
        hx-vals='{"customValue": 87, "boolean": true}'>
        <input type="hidden" name="foo" value="bar" />
        <button id="btnSubmit" type="submit">Submit</button>
      </form>`)

    byId('btnSubmit').click()
    await this.server.respond()
  })

  it('handles multiple values per key', async function () {
    this.server.respondWith('POST', '/test', function (xhr) {
      var values = JSON.parse(xhr.requestBody)
      values.should.have.keys('foo', 'bar')
      values.foo.should.be.instanceOf(Array)
      values.foo.length.should.equal(3)
      values.foo[0].should.equal('A')
      values.foo[1].should.equal('B')
      values.foo[2].should.equal('C')
      values.bar.should.equal('D')
      xhr.respond(200, {}, 'OK')
    })

    var form = make(`
      <form hx-post="/test" hx-ext="form-json" > 
        <input type="text" name="foo" value="A">
        <input type="text" name="foo" value="B">
        <input type="text" name="foo" value="C">
        <input type="text" name="bar" value="D">
        <button id="btnSubmit">Submit</button>
      </form>`)

    byId('btnSubmit').click()
    await this.server.respond()
    form.innerHTML.should.equal('OK')
  })

  it('handles multiple select', async function () {
    this.server.respondWith('POST', '/test', function (xhr) {
      var values = JSON.parse(xhr.requestBody)
      values.should.have.keys('foo', 'bar')
      values.foo.should.be.instanceOf(Array)
      values.foo.length.should.equal(2)
      values.foo[0].should.equal('A')
      values.foo[1].should.equal('C')
      values.bar.should.equal('D')
      xhr.respond(200, {}, 'OK')
    })

    var form = make(`
      <form hx-post="/test" hx-ext="form-json" >
      <select multiple="multiple" name="foo">
      <option value="A" selected="selected">A</option>
      <option value="B">B</option>
      <option value="C" selected="selected">C</option>
      </select>
      <input type="text" name="bar" value="D">
      <button id="btnSubmit">Submit</button>
      </form>`)

    byId('btnSubmit').click()
    await this.server.respond()
    form.innerHTML.should.equal('OK')
  })

  it('handles multiple type', async function () {
    this.server.respondWith('POST', '/test', function (xhr) {
      var values = JSON.parse(xhr.requestBody)
      values.should.have.keys('foo', 'bar', 'textarea', 'checkbox')
      values.foo.should.equal(2)
      values.bar.should.equal(87)
      values.textarea.should.equal('Schrodinger\'s cat is alive')
      values.checkbox.should.equal(true)
      xhr.respond(200, {}, 'OK')
    })

    var form = make(`
      <form hx-post="/test" hx-ext="form-json" >
        <input type="number".  name="foo" value="2" />
        <input type="range"    name="bar" min="0" max="100" value="87" />
        <input type="checkbox" name="checkbox"    checked />
        <input type="checkbox" name="not_checked" />
        <textarea name="textarea" >Schrodinger\'s cat is alive</textarea>
        <button id="btnSubmit">Submit</button>
      </form>`)

    byId('btnSubmit').click()
    await this.server.respond()
    form.innerHTML.should.equal('OK')
  })

  it('casts number when hx-post is on submit button', async function () {
    this.server.respondWith('POST', '/test', function (xhr) {
      var values = JSON.parse(xhr.requestBody)
      values.Name.should.equal('Lorem ipsum')
      values.Price.should.equal(19.99)
      values.Price.should.be.a('number')

      xhr.respond(200, {}, 'OK')
    })

    make(`
    <form hx-ext="form-json">
      <input
        name="Name"
        type="text"
        value="Lorem ipsum">

      <input
        name="Price"
        type="number"
        value="19.99">

      <button
        id="btnSubmit"
        type="submit"
        hx-post="/test">
        Save
      </button>
    </form>
  `)

    byId('btnSubmit').click()
    await this.server.respond()
  })

  //  README examples  //////////////////////////////////////////

  it('preserves input types', async function () {
    this.server.respondWith('POST', '/test', function (xhr) {
      var values = JSON.parse(xhr.requestBody)

      chai.assert.deepEqual(values, {
        name: 'John',
        age: 30,
        checkbox_1: true,
        checkbox_2: 'data',
        list: [1, 2, 3]
      })

      xhr.respond(200, {}, 'OK')
    })

    make(`
      <form hx-ext="form-json" hx-post="/test">
        <input name="name"       type="text"     value="John" />
        <input name="age"        type="number"   value="30" />
        <input name="checkbox_1" type="checkbox"              checked />
        <input name="checkbox_2" type="checkbox" value="data" checked />
        <input name="list"       type="number"   value="1" />
        <input name="list"       type="number"   value="2" />
        <input name="list"       type="number"   value="3" />

        <button id="btnSubmit" type="submit">Submit</button>
      </form>
    `)

    byId('btnSubmit').click()
    await this.server.respond()
  })

  it('handles nested objects and arrays', async function () {
    this.server.respondWith('POST', '/test', function (xhr) {
      var values = JSON.parse(xhr.requestBody)

      chai.assert.deepEqual(values, {
        pet: {
          species: 'Dahut',
          name: 'Hypatia'
        },
        data: {
          person: [
            { name: 'Alice' },
            null,
            { name: 'Bob' }
          ]
        }
      })

      xhr.respond(200, {}, 'OK')
    })

    make(`
      <form hx-ext="form-json" hx-post="/test">
        <input name="pet.species" value="Dahut" />
        <input name="pet[name]" value="Hypatia" />
        <input name="data.person[2].name" value="Bob" />
        <input name="data.person.0.name" value="Alice" />

        <button id="btnSubmit" type="submit">Submit</button>
      </form>
    `)

    byId('btnSubmit').click()
    await this.server.respond()
  })

  it('handles merge behavior when scalar, array and object paths conflict', async function () {
    this.server.respondWith('POST', '/test', function (xhr) {
      var values = JSON.parse(xhr.requestBody)

      chai.assert.deepEqual(values, {
        mix: {
          '': 'scalar',
          '0': 'array 1',
          '2': 'array 2',
          key: 'key key',
          car: 'car key'
        }
      })

      xhr.respond(200, {}, 'OK')
    })

    make(`
      <form hx-ext="form-json" hx-post="/test">
        <input name="mix"      value="scalar" />
        <input name="mix[0]"   value="array 1" />
        <input name="mix[2]"   value="array 2" />
        <input name="mix.key"  value="key key" />
        <input name="mix[car]" value="car key" />

        <button id="btnSubmit" type="submit">Submit</button>
      </form>
    `)

    byId('btnSubmit').click()
    await this.server.respond()
  })

  it('handles append notation', async function () {
    this.server.respondWith('POST', '/test', function (xhr) {
      var values = JSON.parse(xhr.requestBody)

      chai.assert.deepEqual(values, {
        highlander: ['one', 'twe']
      })

      xhr.respond(200, {}, 'OK')
    })

    make(`
      <form hx-ext="form-json" hx-post="/test">
        <input name="highlander[]" value="one" />
        <input name="highlander[]" value="twe" />

        <button id="btnSubmit" type="submit">Submit</button>
      </form>
    `)

    byId('btnSubmit').click()
    await this.server.respond()
  })

  it('handles deeply nested objects and arrays', async function () {
    this.server.respondWith('POST', '/test', function (xhr) {
      var values = JSON.parse(xhr.requestBody)

      chai.assert.deepEqual(values, {
        wow: {
          such: {
            deep: [
              null,
              null,
              null,
              {
                much: {
                  power: {
                    '!': 'Amaze'
                  }
                }
              }
            ]
          }
        }
      })

      xhr.respond(200, {}, 'OK')
    })

    make(`
      <form hx-ext="form-json" hx-post="/test">
        <input
          name="wow.such[deep][3][much].power[!]"
          value="Amaze"
        />

        <button id="btnSubmit" type="submit">Submit</button>
      </form>
    `)

    byId('btnSubmit').click()
    await this.server.respond()
  })

  it('handles ignore-deep-key attribute', async function () {
    this.server.respondWith('POST', '/test', function (xhr) {
      var values = JSON.parse(xhr.requestBody)

      chai.assert.deepEqual(values, {
        'wow.such[deep][3][much][power][!]': 'Amaze'
      })

      xhr.respond(200, {}, 'OK')
    })

    make(`
      <form
        hx-ext="form-json"
        hx-post="/test"
        ignore-deep-key
      >
        <input
          name="wow.such[deep][3][much][power][!]"
          value="Amaze"
        />

        <button id="btnSubmit" type="submit">Submit</button>
      </form>
    `)

    byId('btnSubmit').click()
    await this.server.respond()
  })

  it('handles ignore-drop-false-option attribute', async function () {
    this.server.respondWith('POST', '/test', function (xhr) {
      var values = JSON.parse(xhr.requestBody)

      chai.assert.deepEqual(values, {
        newsletter: false
      })

      xhr.respond(200, {}, 'OK')
    })

    make(`
      <form
        hx-ext="form-json"
        hx-post="/test"
        ignore-drop-false-option
      >
        <input
          type="checkbox"
          name="newsletter"
        />

        <button id="btnSubmit" type="submit">Submit</button>
      </form>
    `)

    byId('btnSubmit').click()
    await this.server.respond()
  })

  it('handles ignore-drop-false-option-array attribute', async function () {
    this.server.respondWith('POST', '/test', function (xhr) {
      var values = JSON.parse(xhr.requestBody)

      chai.assert.deepEqual(values, {
        options: ['A', false, false]
      })

      xhr.respond(200, {}, 'OK')
    })

    make(`
      <form
        hx-ext="form-json"
        hx-post="/test"
        ignore-drop-false-option-array
      >
        <label>
          <input
            type="checkbox"
            name="options[]"
            value="A"
            checked
          />
          A
        </label>

        <label>
          <input
            type="checkbox"
            name="options[]"
            value="B"
          />
          B
        </label>

        <label>
          <input
            type="checkbox"
            name="options[]"
            value="C"
          />
          C
        </label>

        <button id="btnSubmit" type="submit">Submit</button>
      </form>
    `)

    byId('btnSubmit').click()
    await this.server.respond()
  })
})

