/* global TimeService, ToolsService */

module.exports = {

  isValidCustomFields,
  checkCustomField,

  checkData,
  checkDataValue,

};

const _ = require('lodash');

const customFieldTypes = [
  'number',
  'boolean',
  'date',
  'text', // for input
  'textarea', // for textarea
  'checkbox', // multiple choices, select multiple values
  'select', // multiple choices, select one value
];

function isEmptyValue(value) {
  return typeof value === 'undefined' || value === null;
}

function isValidCustomFields(customFields) {
  if (!_.isArray(customFields)) return false;

  const valid = _.reduce(customFields, (memo, customField) => {
      if (!checkCustomField(customField)) {
          return false;
      }
      return memo;
  }, true);

  if (!valid) return false;

  const names = _.pluck(customFields, 'name');
  const hasUniqueNames = names.length === _.uniq(names).length;
  if (!hasUniqueNames) return false;

  return true;
}

/**
* @param {Object} customField
* @param {String} customField.name - name of the custom field
* @param {String} customField.label - label to display to users
* @param {String} customField.type - type of data
* @param {Boolean} customField.filter - if true, can be used for search (otherwise it is only for display)
* @param {String} customField.visibility - only two values possibles for now: ['admin', 'all']
* @param {String} [customField.instructions] - help info
* @param {Any} [customField.defaultValue] - if the custom field is null or undefined, set the default value
* @param {Boolean} [customField.required] - if true, the custom field must be present
* @param {Boolean} [customField.isInteger] - only for type corresponding to numbers
* @param {String} [customField.placeholder] - display a placeholder for specific inputs
* @param {Number} [customField.minValue] - only for type corresponding to numbers
* @param {Number} [customField.maxValue] - only for type corresponding to numbers
* @param {String} [customField.minLength] - only for type corresponding to texts
* @param {String} [customField.maxLength] - only for type corresponding to texts
* @param {Object[]} [customField.choices] - only for type with multiple pre-defined values
* @param {String} customField.choices[i].value
* @param {String} customField.choices[i].label - label to display besides the value
* @return {Boolean}
*/
function checkCustomField(customField) {
  if (typeof customField !== 'object') return false;

  const {
      name,
      label,
      type,
      filter,
      visibility,
      instructions,
      defaultValue,
      required,
      placeholder,
      isInteger,
      minValue,
      maxValue,
      minLength,
      maxLength,
      choices,
  } = customField;

  const isValidChoice = (choice) => {
    if (typeof choice !== 'object') return false;

    return (choice.value && typeof choice.value === 'string')
        && (choice.label && typeof choice.label === 'string');
  };

  const isValidChoices = _.reduce(choices, (memo, choice) => {
      if (!isValidChoice(choice)) {
          return false;
      }
      return memo;
  }, true);

  if ((!name || typeof name !== 'string')
   || (!label || typeof label !== 'string')
   || !_.includes(customFieldTypes, type)
   || typeof filter !== 'boolean'
   || !_.includes(['admin', 'all'], visibility)
   || (!isEmptyValue(instructions) && typeof instructions !== 'string')
   || (!isEmptyValue(required) && typeof required !== 'boolean')
   || (!isEmptyValue(placeholder) && typeof placeholder !== 'string')
   || (!isEmptyValue(isInteger) && typeof isInteger !== 'boolean')
   || (!isEmptyValue(minValue) && typeof minValue !== 'number')
   || (!isEmptyValue(maxValue) && typeof maxValue !== 'number')
   || (!isEmptyValue(minLength) && typeof minLength !== 'number' && ToolsService.isWithinIntegerRange(minLength, { min: 0 }))
   || (!isEmptyValue(maxLength) && typeof maxLength !== 'number' && ToolsService.isWithinIntegerRange(maxLength, { min: 0 }))
   || (!isEmptyValue(choices) && !_.isArray(choices))
  ) {
      return false;
  }

  if (!isValidChoices) return false;
  if (!isEmptyValue(minValue) && !isEmptyValue(maxValue) && maxValue < minValue) return false;
  if (!isEmptyValue(minLength) && !isEmptyValue(maxLength) && maxLength < minLength) return false;
  if (_.includes(['checkbox', 'select'], type) && isEmptyValue(choices)) return false;
  if (!isEmptyValue(defaultValue) && !checkDataValue(defaultValue, customField)) return false;

  return true;
}

/**
 *
 * @param {Object} data
 * @param {Object[]} customFields
 * @return {Object} res
 * @return {Object} res.newData - null if not valid
 * @return {Boolean} res.valid
 */
function checkData(data, customFields) {
  const res = {
    newData: null,
    valid: true,
  };

  const newData = _.assign({}, data);

  _.forEach(customFields, field => {
    if (!res.valid) return; // stop the process if the data isn't valid

    const value = data[field.name];

    if (isEmptyValue(value)) {
      if (field.required) {
        res.valid = false; // required field but provide empty value
        return;
      }
      if (!isEmptyValue(field.defaultValue)) { // use default value if defined for empty value
        newData[field.name] = field.defaultValue;
      }
    } else {
      if (!checkDataValue(value, field)) {
        res.valid = false;
      }
    }
  });

  if (!res.valid) return res;

  res.newData = newData;
  return res;
}

function checkDataValue(value, field) {
  switch (field.type) {
    case 'number':
      return checkDataNumber(value, field);

    case 'boolean':
      return checkDataBoolean(value, field);

    case 'date':
      return checkDataDate(value, field);

    case 'text':
    case 'textarea':
      return checkDataText(value, field);

    case 'checkbox':
      return checkDataCheckbox(value, field);

    case 'select':
      return checkDataSelect(value, field);

    case 'default':
      return false;
  }
}

function checkDataNumber(value, field) {
  if (field.isInteger) {
    return ToolsService.isWithinIntegerRange(value, { min: field.minValue, max: field.maxValue });
  } else {
    return ToolsService.isWithinNumberRange(value, { min: field.minValue, max: field.maxValue });
  }
}

function checkDataBoolean(value /*, field */) {
  return typeof value === 'boolean';
}

function checkDataDate(value /*, field */) {
  return TimeService.isDateString(value);
}

function checkDataText(value, field) {
  if (typeof value !== 'string') return false;
  return ToolsService.isWithinIntegerRange(value.length, { min: field.minLength, max: field.maxLength });
}

function checkDataCheckbox(value, field) {
  if (!_.isArray(value)) return false;

  const possibleValues = _.pluck(field.choices, 'value');
  const indexedPossibleValues = _.indexBy(possibleValues);

  const valid = _.reduce(value, (memo, v) => {
    if (typeof v !== 'string'
     || !indexedPossibleValues[v]
    ) {
      return false;
    }
    return memo;
  }, true);

  if (!valid) return false;

  // check if the array hasn't the same value multiple times
  const uniqueValues = _.uniq(value);
  return uniqueValues.length === value.length;
}

function checkDataSelect(value, field) {
  if (typeof value !== 'string') return false;

  const possibleValues = _.pluck(field.choices, 'value');
  return _.includes(possibleValues, value);
}
