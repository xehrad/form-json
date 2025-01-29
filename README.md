# form-json
This is an [HTMX](https://htmx.org/) extension that enables the transformation of form data into a structured JSON object. The extension supports the [HTML JSON form](https://www.w3.org/TR/html-json-forms/) specification and works seamlessly with all examples outlined in the standard.

## Features

- **JSON Serialization**: Converts form inputs into a JSON object.
- **Nested Structures**: Supports complex nested structures with dot (`.`) or bracket (`[]`) notation.
- **Array and Object Handling**: Automatically detects arrays, objects, and scalar values based on field names and their indices.
- **Type Preservation**: Ensures correct typing for number, boolean, file, and other input types.
- **File Uploads**: Encodes file inputs as Base64 for seamless transmission.
- **Compatibility with `htmx`**: Integrates with `htmx` events to set appropriate headers and handle form submissions.

## Install

Add the JavaScript file to your project and include it in your HTML:

```html
<script src="https://unpkg.com/htmx-ext-form-json@1.0.1"></script>
```

Enable the extension in your htmx configuration:

```html
<form hx-ext="form-json" hx-post="/test" hx-vals='{"customValue": 42}'>
    ...
</form>
```

## Usage

The extension automatically serializes `form data` into `JSON` for any form with the `hx-ext="form-json"` attribute. The resulting JSON object adheres to the [HTML JSON form](https://www.w3.org/TR/html-json-forms/) standard, supporting nested objects and arrays.

### Examples from the HTML JSON Forms Specification

#### Mixed Structures
```html
<form hx-ext="form-json" hx-post="/test">
    <input name="name"   value="John" />
    <input name="age"    type="number"   value="30" />
    <input name="config" type="checkbox" checked />
    <input name="pet[0].name" value="Foo" />
    <input name="pet[0].type" value="Dog" />
    <input name="pet[1].name" value="Boo" />
    <input name="pet[1].type" value="Cat" />
</form>

<!-- Submission:
{
    "name": "John",
    "age": 30,
    "config": true,
    "pet":[
        {"name": "Foo", "type": "Dog"},
        {"name": "Boo", "type": "Cat"},
    ]
}
-->
```

#### Files

The `form-json` also supports file uploads. The values of files are themselves structured as objects and contain a `type` field indicating the MIME type, a `name` field containing the file name, and a `body` field with the file's content as base64.
```html
<form hx-ext="form-json" hx-post="/test">
    <input type="file" name="document">
</form>

<!-- Submission:
{
  "document": {
    "type": "application/pdf",
    "name": "file.pdf",
    "body": "SSBtdXN0IG5vdCBmZWFyLlxuRmVhciBpcyB0aGUgbWluZC1raWxsZXIuCg=="
  }
}
-->
```

#### Complex Nesting

```html
<form hx-ext="form-json" hx-post="/test" hx-vals='{"customValue": 87}'>
  <input name='pet.species' value='Dahut'>
  <input name='pet[name]'   value='Hypatia'>
  <input name='kids[1]' value='Thelma'>
  <input name='kids.0'  value='Ashley'>
  <input name="data.person[0].name" value="Alice">
  <input name="data.person[2].name" value="Bob">
  <input type='number' name='bottle-on-wall' value='1'>
  <input type='number' name='bottle-on-wall' value='2'>
  <input type='number' name='bottle-on-wall' value='3'>
  <select name='hind'>
    <option selected>Bitable</option>
    <option>Kickable</option>
  </select>
</form>

<!-- Submission:
{
  "customValue": 87,
  "pet":  {
    "species":  "Dahut",
    "name":     "Hypatia"
  },
  "kids": ["Ashley", "Thelma"],
  "data": {
    "person": [
      { "name": "Alice" },
      null,
      { "name": "Bob" }
    ]
  },
  "bottle-on-wall": [1, 2, 3],
  "hind": "Bitable"
}
-->
```

#### Merge Behaviour

The algorithm does not lose data in that every piece of information ends up being submitted. But given the path syntax, it is possible to introduce clashes such that one may attempt to set an object, an array, and a scalar value on the same key.

```html
<form hx-ext="form-json" hx-post="/test">
  <input name='mix'      value='scalar'>
  <input name='mix[0]'   value='array 1'>
  <input name='mix[2]'   value='array 2'>
  <input name='mix.key'  value='key key'>
  <input name='mix[car]' value='car key'>
</form>

<!-- Submission:
{
  "mix":  {
    "":     "scalar",
    "0":    "array 1",
    "2":    "array 2",
    "key":  "key key",
    "car":  "car key"
    }
}
-->
```

#### Append

an array irrespective of the number of its items, and without resorting to indices, one may use the append notation (only as the final step in a path)

```html
<form hx-ext="form-json" hx-post="/test">
  <input name='highlander[]' value='one'>
  <input name='highlander[]' value='twe'>
</form>

<!-- Submission:
{
  "highlander":  ["one", "twe"]
}
-->
```

#### Complex Nesting
```html
<form hx-ext="form-json" hx-post="/test">
  <input name='wow.such[deep][3][much].power[!]' value='Amaze'>
</form>

<!-- Submission:
{
    "wow":  {
        "such": {
            "deep": [
                null,
                null,
                null,
                {
                    "much": {
                        "power": {
                            "!":  "Amaze"
                        }
                    }
                }
            ]
        }
    }
}
-->
```

### Attribute Ignore Deep Key

Optional attribute to skip parsing keys to struct:
```html
<form hx-ext="form-json" hx-post="/test" ignore-deep-key >
  <input name='wow.such[deep][3][much][power][!]' value='Amaze'>
</form>

<!-- Submission:
{
    "wow.such[deep][3][much][power][!]": "Amaze"
}
-->
```

## Development

To contribute, clone the repository and submit pull requests for features or bug fixes. Ensure all new functionality aligns with the [HTML JSON form](https://www.w3.org/TR/html-json-forms/) standard.

## License

This project is licensed under the GNU GENERAL PUBLIC LICENSE V3. See the LICENSE file for details.
