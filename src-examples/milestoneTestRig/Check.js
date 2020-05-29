import moment from 'moment';

export function isNullOrUndefined(value) {
  return value === undefined || value === null;
}

// note - used below in isEmptyString
export function isEmpty(value) {
  return isNullOrUndefined(value) || value === '';
}

export function isEmptyString(value) {
  return isEmpty(value);
}

export function isEmptyObject(object){
  return isEmpty(object) || Object.keys(object).length === 0;
}

export function isArrayNullOrEmpty(array){
  return !Array.isArray(array) || !array.length;
}

export function isEmptyOrZero(value){
  return value === 0 || value === '0' || isNullOrUndefined(value);
}

export function isEmptyOrZeroColumn(column, rows) {
  const { fieldName,fieldType } = column;
  return (fieldType === 'DECIMAL' ||fieldType === 'LONG'|| fieldType === 'INTEGER' || fieldType === 'WHOLE') &&
    (rows.every(r => isEmptyOrZero(r.values ? r.values[fieldName] : r[fieldName])));
}

export function isBool(value) {
  return value === true || value === 'true' || value === false || value === 'false';
}

export function isRowAddedJustNow(rowData) {
  return rowData?.addRowId ? true : false;
}

export function isEditable(obj) {
  if(!obj) {
    return false;
  }
  const {rowData, column} = obj;
  // PCS-14265, don't edit hierarchy column
  if(column?.hierarchyColumnSetup) {
    return false;
  }

  // We don't support edit for COMBINE
  if(column?.rendererType === 'COMBINE') {
    return false;
  }

  if(rowData?._readonlyTemporarily || rowData?._rowDeletingHighlighted) {
    return false;
  }
  //As per Davids comment pending status should not be effecting editing
  // if(rowData?._hasPendingChange_Default || rowData?._hasPendingChange_Delete) {
  //   return false;
  // }

  if(rowData?._editableCallback && !rowData?._editableCallback(rowData, column.fieldName, column)) {
    return false;
  }

  // as confirmed by Pacita, `undefined`, `null` equals to false
  if(isRowAddedJustNow(rowData) && column?.appendable){
    return true;
  }
  const editable = typeof(column.editable) === 'function' ? column.editable({data: rowData}) : column.editable;
  return rowData?.rowEditable && editable;
}

export function isDropdownType(type) {
  return (type === 'LOOKUP' ||
          type === 'COMMON_ENTITY' ||
          type === 'LOOKUP_VALUE' ||
          type === 'WORKTABLE_COLUMN_DATA' ||
          type === 'ENUM' ||
          type === 'WORKTABLE_TREE_COMBO' ||
          type === 'PRICE_RUN_TYPE');
}

export function isEditableDropdownInCell(obj) {
  return isDropdownType(obj.column.rendererType) && isEditable(obj);
}

export function isEditingCell(obj) {
  return obj.rowData && obj.rowData._editableProperty
    && obj.rowData._editableProperty.property === obj.property
    && !obj.rowData._editableProperty.reset
    && isEditable(obj);
}

/**
 * Can convert UTC timstamp to local time?
 * @param {object} col column setup
 * @returns {string}  formatted time string
 */
export function isFromUTCDateTime(col) {
  const t = col.rendererType;
  /* see perforce change 216895 */
  const arr = [
    'APP_DATE_DATE_TIME',
    'APP_DATE_DISPLAY_DATE_TIME',
  ];
  return arr.findIndex(e => e === t) !== -1;
}

/**
 * Can convert date to our format? No worries about locale
 * @param {object} col column setup
 * @returns {string}  formatted time string
 */
export function isFromDate(col) {
  const t = col.rendererType;
  /* see perforce change 216895 */
  const arr = [
    'APP_DATE_DISPLAY_DATE',
    'DATE',
  ];
  return arr.findIndex(e => e === t) !== -1;
}

/**
 * Can convert date to our format? No worries about locale
 * @param {object} col column setup
 * @returns {string}  formatted time string
 */
export function isFromTime(col) {
  const t = col.rendererType;
  const arr = [
    'APP_DATE_DISPLAY_TIME',
  ];
  return arr.findIndex(e => e === t) !== -1;
}

export function isDateTimeType(type) {
  const arr = [
    'APP_DATE_DATE_TIME',
    'APP_DATE_DISPLAY_DATE_TIME',
    'APP_DATE_DISPLAY_DATE',
    'DATE',
    'APP_DATE_DISPLAY_TIME',
  ];
  return arr.includes(type);
}

export function isTextAreaColumn(col) {
  return col.fieldType === 'TEXT_AREA';
}

/**
 *  Does any editable cells exist?
 *  if model.appendable is true, return true because cells in new row is editable
 * @param {Object} model the table model
 * @returns {boolean} editable result
 */
export function anyEditableCellExistByModel(model) {
  if(!model) {
    return false;
  }
  return model.editable || model.appendable;
}

export function isRowObjectEditable(obj, model) {
  // PCS-17460, as required by Stacey, when model.editable is false but model.appendable is true,
  // new row is editable but exist rows are NOT editable
  // throws if no model const {appendable, editable} = model;
  if(!model || !model.appendable && !model.editable) {
    console.error('isRowObjecteditable failed');
    return false;
  }
  if(model.editable) {
    return isEditable(obj);
  }
  // Only one condition left, editable == false but appendable === true
  if(isRowAddedJustNow(obj.rowData)) {
    return isEditable(obj);
  }
  return false;
}

export function isCellFlagTrue(obj, flag) {
  return (obj.column && obj.column.cell && obj.column.cell[flag]);
}

export function isException(id) {
  return /-(failed|balance difference)/i.test(id) ? true : false;
}

export function isEditedFieldEmpty(rendererType, editedData){
  if(rendererType === 'LOOKUP'){
    return editedData === -1;
  }
  return editedData === '';
}

export function isALVTable(tableName){
  return tableName?.includes('ALV/ALV');
}

export function isALVHighlightNode(tableName, row){
  return isALVTable(tableName) && (row._hasChildren || !row.parentId);
}

export function isEffectiveDate(date){
  //eg: "2017-07-12"
  return moment(date, 'YYYY-MM-DD', true).isValid();
}

export function hasDateParams(params){
  if ((params.entitySearchFromDate || params.fromDate) && (params.entitySearchToDate || params.toDate)) {
    return true;
  }
  return false;
}
