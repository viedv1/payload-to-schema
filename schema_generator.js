document.addEventListener("DOMContentLoaded", () => {
  const jsonPayloadInput = document.getElementById("jsonPayload");
  const fieldContainer = document.getElementById("fields");
  const schemaContainer = document.getElementById("jsonSchema");
  const generateFieldsButton = document.getElementById("generateFields");

  const requiredFields = new Set();
  const fieldTypes = {};
  const fieldFormats = {};
  const fieldEnums = {}; // Track enum values for each field

  // Updated schema types for JSON Schema compatibility
  const schemaTypes = ["string", "number", "integer", "boolean"];
  const formatOptions = {
    string: ["none", "date", "time", "date-time", "email", "hostname", "ipv4", "ipv6", "uri", "uuid"],
    number: ["none", "float", "double"],
    integer: ["none", "int32", "int64"],
    boolean: ["none"]
  };

  function detectType(value) {
    if (Array.isArray(value)) return "array";
    if (value === null) return "null";
    return typeof value;
  }

  generateFieldsButton.addEventListener("click", () => {
    try {
      const jsonData = JSON.parse(jsonPayloadInput.value);
      fieldContainer.innerHTML = "";  // Clear previous field list
      renderFields(jsonData);          // Generate the new field list
      updateSchemaDisplay();           // Display generated schema
    } catch (error) {
      console.error("Invalid JSON format:", error);
      alert("Invalid JSON data. Please ensure the JSON format is correct.");
    }
  });

  function renderFields(obj, path = "", parent = fieldContainer, level = 0) {
    if (typeof obj !== "object" || obj === null) return;

    for (const key in obj) {
      const fieldPath = path ? `${path}.${key}` : key;
      const isObject = typeof obj[key] === "object" && !Array.isArray(obj[key]);

      const fieldRow = document.createElement("div");
      fieldRow.classList.add("field-row");

      // Expand/collapse toggle for nested objects
      if (isObject && Object.keys(obj[key]).length > 0) {
        const toggleButton = document.createElement("button");
        toggleButton.textContent = "🡢";
        toggleButton.classList.add("toggle-button");

        toggleButton.addEventListener("click", () => {
          const nestedGroup = fieldRow.nextSibling;
          nestedGroup.style.display = nestedGroup.style.display === "none" ? "block" : "none";
          toggleButton.textContent = nestedGroup.style.display === "none" ? "🡢" : "🡣";
        });

        fieldRow.appendChild(toggleButton);
      } else {
        const spacer = document.createElement("span");
        spacer.classList.add("spacer");
        fieldRow.appendChild(spacer);
      }

      // Required checkbox and label
      const requiredCheckbox = createRequiredCheckbox(fieldPath);
      const label = createLabel(fieldPath, key);

      fieldRow.appendChild(requiredCheckbox);
      fieldRow.appendChild(label);

      // If this field is not an object, add type, format, and enum input
      if (!isObject) {
        const typeSelect = createTypeDropdown(fieldPath, "string"); // Default type as string
        const formatSelect = createFormatDropdown(fieldPath, "none"); // Default format as none
        const enumInput = createEnumInput(fieldPath);

        typeSelect.setAttribute("onchange", "adjustWidth(this)");
        formatSelect.setAttribute("onchange", "adjustWidth(this)");

        fieldRow.appendChild(typeSelect);
        fieldRow.appendChild(formatSelect);
        fieldRow.appendChild(enumInput);

        // Adjust width initially
        adjustWidth(typeSelect);
        adjustWidth(formatSelect);
      } else {
        // Automatically set the type to "object" for fields with nested content
        fieldTypes[fieldPath] = "object";
      }

      parent.appendChild(fieldRow);

      // Render nested fields if this is an object with children
      if (isObject) {
        const nestedGroup = document.createElement("div");
        nestedGroup.classList.add("field-group");
        nestedGroup.style.display = "none";
        parent.appendChild(nestedGroup);
        renderFields(obj[key], fieldPath, nestedGroup, level + 1);
      }
    }
  }

  function createRequiredCheckbox(path) {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.path = path;
    checkbox.classList.add("required-checkbox");
    checkbox.addEventListener("change", (event) => {
      if (event.target.checked) {
        requiredFields.add(path);
      } else {
        requiredFields.delete(path);
      }
      updateSchemaDisplay();
    });
    return checkbox;
  }

  function createLabel(path, key) {
    const label = document.createElement("label");
    label.textContent = ` ${key}`;
    return label;
  }

  function createTypeDropdown(path, defaultType = "string") {
    const typeSelect = document.createElement("select");
    typeSelect.setAttribute("onchange", "adjustWidth(this)");
    schemaTypes.forEach(type => {
      const option = document.createElement("option");
      option.value = type;
      option.textContent = type;
      if (type === defaultType) option.selected = true;
      typeSelect.appendChild(option);
    });

    typeSelect.addEventListener("change", (event) => {
      fieldTypes[path] = event.target.value;
      updateFormatOptions(path, event.target.value); // Update format dropdown based on type

      // Hide enum input if type is boolean
      const enumInput = document.querySelector(`input[data-path="${path}-enum"]`);
      if (enumInput) enumInput.style.display = event.target.value === "boolean" ? "none" : "inline-block";

      updateSchemaDisplay();
    });

    return typeSelect;
  }

  function createFormatDropdown(path, defaultFormat = "none") {
    const formatSelect = document.createElement("select");
    formatSelect.setAttribute("onchange", "adjustWidth(this)");
    formatSelect.dataset.path = `${path}-format`;

    formatSelect.addEventListener("change", (event) => {
      fieldFormats[path] = event.target.value === "none" ? undefined : event.target.value;
      updateSchemaDisplay();
    });

    // Populate format options based on default type
    updateFormatOptions(path, "string", defaultFormat); // "string" as the default type
    return formatSelect;
  }

  function updateFormatOptions(path, type, defaultFormat = "none") {
    const formatSelect = document.querySelector(`select[data-path="${path}-format"]`);

    if (formatSelect) {
      formatSelect.innerHTML = ""; 
      const options = formatOptions[type] || [];

      options.forEach((format) => {
        const option = document.createElement("option");
        option.value = format;
        option.textContent = format;
        formatSelect.appendChild(option);
      });

      // Set "none" as the default selection
      formatSelect.value = defaultFormat;
      fieldFormats[path] = defaultFormat === "none" ? undefined : defaultFormat;
    }
  }

  function createEnumInput(path) {
    const enumInput = document.createElement("input");
    enumInput.type = "text";
    enumInput.placeholder = "enum";
    enumInput.classList.add("enum-input");
    enumInput.dataset.path = `${path}-enum`;

    enumInput.addEventListener("input", (event) => {
      const selectedType = fieldTypes[path];
      const values = event.target.value
        .split(",")
        .map(val => val.trim())
        .filter(Boolean)
        .map(val => {
          if (selectedType === "number" || selectedType === "integer") {
            return isNaN(val) ? val : Number(val);
          }
          if (selectedType === "boolean") {
            return val.toLowerCase() === "true" ? true : val.toLowerCase() === "false" ? false : val;
          }
          return val;
        });
      if (values.length > 0) {
        fieldEnums[path] = values;
      } else {
        delete fieldEnums[path];
      }
      updateSchemaDisplay();
    });

    return enumInput;
  }

  function updateSchemaDisplay() {
    try {
      const schema = generateSchema(JSON.parse(jsonPayloadInput.value || "{}"));
      schemaContainer.value = JSON.stringify(schema, null, 2);
    } catch (error) {
      console.error("Schema generation error:", error);
    }
  }

  function generateSchema(obj) {
    const schema = { type: "object", properties: {}, required: [] };
    buildSchema(schema, obj);
    return schema;
  }

  function buildSchema(schemaObj, dataObj, path = "") {
    for (const key in dataObj) {
      const fieldPath = path ? `${path}.${key}` : key;
      const fieldType = fieldTypes[fieldPath] || detectType(dataObj[key]);

      schemaObj.properties[key] = { type: fieldType };
      if (fieldFormats[fieldPath]) schemaObj.properties[key].format = fieldFormats[fieldPath];
      if (fieldEnums[fieldPath]) schemaObj.properties[key].enum = fieldEnums[fieldPath];
      
      // Initialize required array for the current schemaObj if needed
      if (requiredFields.has(fieldPath)) {
        schemaObj.required = schemaObj.required || [];
        schemaObj.required.push(key);
      }

      // Initialize properties for nested objects if the field is an object type
      if (fieldType === "object" && dataObj[key] !== null && !Array.isArray(dataObj[key])) {
        schemaObj.properties[key].properties = {};
        schemaObj.properties[key].required = [];
        buildSchema(schemaObj.properties[key], dataObj[key], fieldPath);
      }
    }
  }

  // Initialize width on load
  const dropdowns = document.querySelectorAll("select");
  dropdowns.forEach(dropdown => adjustWidth(dropdown));
});

function adjustWidth(select) {
  if (select.options.length === 0 || select.selectedIndex === -1) {
    return;
  }

  const option = select.options[select.selectedIndex];
  const temp = document.createElement("span");
  temp.style.font = window.getComputedStyle(select).font;
  temp.style.visibility = "hidden";
  temp.style.whiteSpace = "nowrap";
  temp.innerText = option.text;
  document.body.appendChild(temp);

  select.style.width = `${temp.offsetWidth + 20}px`; // Add some padding
  document.body.removeChild(temp);
}

// Initialize width on load
document.addEventListener("DOMContentLoaded", () => {
  const dropdowns = document.querySelectorAll("select");
  dropdowns.forEach(dropdown => adjustWidth(dropdown));
});