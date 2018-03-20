/* global TimeService, ToolsService */

module.exports = {

  isValidCustomAttributes,
  checkCustomAttribute,

  checkData,
  checkDataValue,

};

const _ = require('lodash');

const customAttributeTypes = [
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

function isValidCustomAttributes(customAttributes) {
  if (!_.isArray(customAttributes)) return false;

  const valid = _.reduce(customAttributes, (memo, customAttribute) => {
      if (!checkCustomAttribute(customAttribute)) {
          return false;
      }
      return memo;
  }, true);

  if (!valid) return false;

  const names = _.pluck(customAttributes, 'name');
  const hasUniqueNames = names.length === _.uniq(names).length;
  if (!hasUniqueNames) return false;

  return true;
}

/**
* @param {Object} customAttribute
* @param {String} customAttribute.name - name of the custom attribute
* @param {String} customAttribute.label - label to display to users
* @param {String} customAttribute.type - type of data
* @param {Boolean} customAttribute.filter - if true, can be used for search (otherwise it is only for display)
* @param {String} customAttribute.visibility - only two values possibles for now: ['admin', 'all']
* @param {String} [customAttribute.instructions] - help info
* @param {Any} [customAttribute.defaultValue] - if the custom attribute is null or undefined, set the default value
* @param {Boolean} [customAttribute.required] - if true, the custom attribute must be present
* @param {Boolean} [customAttribute.isInteger] - only for type corresponding to numbers
* @param {String} [customAttribute.placeholder] - display a placeholder for specific inputs
* @param {Number} [customAttribute.minValue] - only for type corresponding to numbers
* @param {Number} [customAttribute.maxValue] - only for type corresponding to numbers
* @param {String} [customAttribute.minLength] - only for type corresponding to texts
* @param {String} [customAttribute.maxLength] - only for type corresponding to texts
* @param {Object[]} [customAttribute.choices] - only for type with multiple pre-defined values
* @param {String} customAttribute.choices[i].value
* @param {String} customAttribute.choices[i].label - label to display besides the value
* @return {Boolean}
*/
function checkCustomAttribute(customAttribute) {
  if (typeof customAttribute !== 'object') return false;

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
  } = customAttribute;

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
   || !_.includes(customAttributeTypes, type)
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
  if (!isEmptyValue(defaultValue) && !checkDataValue(defaultValue, customAttribute)) return false;

  return true;
}

/**
 *
 * @param {Object} data
 * @param {Object[]} customAttributes
 * @return {Object} res
 * @return {Object} res.newData - null if not valid
 * @return {Boolean} res.valid
 */
function checkData(data, customAttributes) {
  const res = {
    newData: null,
    valid: true,
  };

  const newData = _.assign({}, data);

  _.forEach(customAttributes, attr => {
    if (!res.valid) return; // stop the process if the data isn't valid

    const value = data[attr.name];

    if (isEmptyValue(value)) {
      if (attr.required) {
        res.valid = false; // required attribute but provide empty value
        return;
      }
      if (!isEmptyValue(attr.defaultValue)) { // use default value if defined for empty value
        newData[attr.name] = attr.defaultValue;
      }
    } else {
      if (!checkDataValue(value, attr)) {
        res.valid = false;
      }
    }
  });

  if (!res.valid) return res;

  res.newData = newData;
  return res;
}

function checkDataValue(value, attr) {
  switch (attr.type) {
    case 'number':
      return checkDataNumber(value, attr);

    case 'boolean':
      return checkDataBoolean(value, attr);

    case 'date':
      return checkDataDate(value, attr);

    case 'text':
    case 'textarea':
      return checkDataText(value, attr);

    case 'checkbox':
      return checkDataCheckbox(value, attr);

    case 'select':
      return checkDataSelect(value, attr);

    case 'default':
      return false;
  }
}

function checkDataNumber(value, attr) {
  if (attr.isInteger) {
    return ToolsService.isWithinIntegerRange(value, { min: attr.minValue, max: attr.maxValue });
  } else {
    return ToolsService.isWithinNumberRange(value, { min: attr.minValue, max: attr.maxValue });
  }
}

function checkDataBoolean(value /*, attr */) {
  return typeof value === 'boolean';
}

function checkDataDate(value /*, attr */) {
  return TimeService.isDateString(value);
}

function checkDataText(value, attr) {
  if (typeof value !== 'string') return false;
  return ToolsService.isWithinIntegerRange(value.length, { min: attr.minLength, max: attr.maxLength });
}

function checkDataCheckbox(value, attr) {
  if (!_.isArray(value)) return false;

  const possibleValues = _.pluck(attr.choices, 'value');
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

function checkDataSelect(value, attr) {
  if (typeof value !== 'string') return false;

  const possibleValues = _.pluck(attr.choices, 'value');
  return _.includes(possibleValues, value);
}
