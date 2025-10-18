# form-json
This is an [HTMX](https://htmx.org/) extension that enables the transformation of form data into a structured JSON object. The extension supports the [HTML JSON form](https://www.w3.org/TR/html-json-forms/) specification and works seamlessly with all examples outlined in the standard.

## Features

- **JSON Serialization**: Converts form inputs into a JSON object.
- **Nested Structures**: Supports complex nested structures with dot (`.`) or bracket (`[]`) notation.
- **Array and Object Handling**: Automatically detects arrays, objects, and scalar values based on field names and their indices.
- **Type Preservation**: Ensures correct typing for number, boolean, file, and other input types.
- **Compatibility with `htmx`**: Integrates with `htmx` events to set appropriate headers and handle form submissions.

## Install

Add the JavaScript file to your project and include it in your HTML:

```html
<script src="https://unpkg.com/htmx.org@2.0.4"></script>
<script src="https://unpkg.com/htmx-ext-form-json"></script>
```

Enable the extension in your htmx configuration:

```html
<form hx-ext="form-json" hx-post="/test">
    ...
</form>
```

## Usage

The extension automatically serializes `form data` into `JSON` for any form with the `hx-ext="form-json"` attribute. The resulting JSON object adheres to the [HTML JSON form](https://www.w3.org/TR/html-json-forms/) standard, supporting nested objects and arrays.

### Examples from the HTML JSON Forms Specification

#### Type Preservation
```html
<form hx-ext="form-json"   hx-post="/test">
  <input name="name"       type="text"     value="John" />
  <input name="age"        type="number"   value="30" />
  <input name="checkbox_1" type="checkbox"              checked />
  <input name="checkbox_2" type="checkbox" value="data" checked />
  <input name="list"       type="number"   value="1" />
  <input name="list"       type="number"   value="2" />
  <input name="list"       type="number"   value="3" />
</form>

<!-- Submission:
{
    "name": "John",
    "age": 30,
    "checkbox_1": true,
    "checkbox_2": "data",
    "list": [1, 2, 3]
}
-->
```

#### Complex Nesting

```html
<form hx-ext="form-json" hx-post="/test">
  <input name="pet.species" value="Dahut" />
  <input name="pet[name]"   value="Hypatia" />
  <input name="data.person[2].name" value="Bob" />
  <input name="data.person.0.name" value="Alice" />
</form>

<!-- Submission:
{
  "pet":  {
    "species":  "Dahut",
    "name":     "Hypatia"
  },
  "data": {
    "person": [
      { "name": "Alice" },
      null,
      { "name": "Bob" }
    ]
  }
}
-->
```

#### Hidden Value

There are two ways to send **hidden values** in a form:  

1. Using a hidden input field (`<input type="hidden">`).
2. Using `hx-vals` to inject custom values dynamically.

Note: that hidden input fields always send values as **strings**, which means if you're dealing with **Boolean** or **Number** types, you should use `hx-vals` to ensure the correct data type is sent.

```html
<form hx-ext="form-json" hx-post="/test" hx-vals='{"customValue": 87, "boolean": true}'>
  <input type="hidden" name="foo" value="bar" />
</form>

<!-- Submission:
{
  "customValue": 87,
  "boolean": true,
  "foo":  "bar"
}
-->
```

#### Merge Behavior

The algorithm does not lose data in that every piece of information ends up being submitted. But given the path syntax, it is possible to introduce clashes such that one may attempt to set an object, an array, and a scalar value on the same key.

```html
<form hx-ext="form-json" hx-post="/test">
  <input name="mix"      value="scalar"  />
  <input name="mix[0]"   value="array 1" />
  <input name="mix[2]"   value="array 2" />
  <input name="mix.key"  value="key key" />
  <input name="mix[car]" value="car key" />
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
  <input name="highlander[]" value="one" />
  <input name="highlander[]" value="twe" />
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
  <input name="wow.such[deep][3][much].power[!]" value="Amaze" />
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

## Attribute

### Attribute `ignore-deep-key`

Ignore Deep Key is Optional attribute to skip parsing keys to struct:
```html
<form hx-ext="form-json" hx-post="/test" ignore-deep-key >
  <input name="wow.such[deep][3][much][power][!]" value="Amaze" />
</form>

<!-- Submission:
{
    "wow.such[deep][3][much][power][!]": "Amaze"
}
-->
```

### Attribute `ignore-drop-false-option`

By default, unchecked single checkboxes are **omitted** from the JSON output (same as HTML form submission behavior).

If you add the `ignore-drop-false-option` attribute to your `<form>`, unchecked single checkboxes will instead be included with a `false` value.

```html
<form hx-ext="form-json" hx-post="/test" ignore-drop-false-option>
  <input type="checkbox" name="newsletter" />
</form>

<!-- Submission:
{
  "newsletter": false
}
-->
```

### Attribute `ignore-drop-false-option-array`

By default, unchecked checkboxes in a group (`name="options[]"`) are omitted, and only checked values are included in the array.

If you add the `ignore-drop-false-option-array` attribute to your `<form>`, unchecked checkboxes in a group will explicitly push `false` into the array.

```html
<form hx-ext="form-json" hx-post="/test" ignore-drop-false-option-array>
  <label><input type="checkbox" name="options[]" value="A" checked /> A </label>
  <label><input type="checkbox" name="options[]" value="B"         /> B </label>
  <label><input type="checkbox" name="options[]" value="C"         /> C </label>
</form>

<!-- Submission:
{
  "options": ["A", false, false]
}
-->
```

## Development

To contribute, clone the repository and submit pull requests for features or bug fixes. Ensure all new functionality aligns with the [HTML JSON form](https://www.w3.org/TR/html-json-forms/) standard.

---

## ⭐️ Like it? Star it!

If this project saves you time or sparks ideas, please [⭐ star the repo](https://github.com/xehrad/form-json) — it really helps us grow the community.
