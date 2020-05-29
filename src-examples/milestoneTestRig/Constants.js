
//Date Formats
export const serverDateFormat = 'YYYYMMDD'; // date format used by moment
export const data_serverDateFormat_DateFns = 'yyyyMMdd'; // new date format required by date-fns
//TODO: fix all code which uses this format to the one above!
export const serverDateFormat_DateFns = 'yyyy-MM-dd'; // new date format required by date-fns
export const serverDateTimeFormat = 'YYYY-MM-DDTHH:mm:ssZ'; // date-time format used by moment

export const serverTimeFormat = 'HHmmssSSS'; // date format used by moment
export const serverTimeFormat_DateFns = 'HHmmssSSS'; // date format used by date-fns
//@deprecated - use above formats everywhere instead
export const serverDateFormat_WorkTable = 'YYYYMMDD'; // date format used by api/worktable/modify
export const serverDateFormat_WorkTable_DateFns = 'yyyyMMdd'; // new date format required by date-fns

//Primary Filter Search
export const typeTemplates = 'TYPE_TEMPLATES';
export const typeCollections = 'TYPE_COLLECTIONS';

//Dashboard Page Keys
export const clientDashboardPK = 'clientDashboard';
export const processDashboardPK = 'processDashboard';
export const pendingChangesDashboardPK = 'pendingChangesDashboard';
export const clientDetailPK = 'clientDetail';
export const processDetailPK = 'processDetail';
export const pendingChangesDetailPK = 'pendingChangesDetail';
export const FVCDashBoardPK = 'FVCDashboard';
export const dashboardPages = ['ProcessDashboard','FVCDashboard'];
export const detailsPages = ['ProcessDashboardDetails'];

export const NEW_ROW_KEY = 'NewRow';

// TODO remove this - it's only used as a fallback if other methods to
// get it fail.  The Worktable code no longer uses it.  These continue to use
// it as fallback:
//   FxRatesService
//   PageDefalutlsService
export const maxRecordsFromServer = 2000;

// This is used to identify record status
export const RECORD_TYPE = {
  NEW: 'NEW',
  EDITED: 'EDITED',
  EXISTING_DELETED: 'EXISTING_DELETED',
  NONE: 'NONE',
};

export const PENDING_ACTION_STATUS = {
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  CREATE: 'CREATE',
};

export const OPERATOR_MAPPING = {
  // number type
  '=': 'Is equal to',
  ABS_EQ: 'Has absolute value',
  '!=': 'Does not equal',
  '>': 'Is greater than',
  '>=': 'Is greater than or equal to',
  '<': 'Is less than',
  '<=': 'Is less than or equal to',
  '<>': 'Is between',
  // text type
  CONTAINS: 'Contains',
  NOT_CONTAINS: 'Does not contain',
  NOT_ENDS_WITH: 'Does not end with',
  ENDS_WITH: 'Ends with',
  NOT_STARTS_WITH: 'Does not start with',
  STARTS_WITH: 'Starts with'
};

export const defaultOption = { code: null,displayValue: null, desc: null, active: true};

export const ProcessDashboardPageCode = 'PAGE_DEFAULTS_PROCESS_DASHBOARD';
export const ProcessDashboardDetailPageCode = 'PAGE_DEFAULTS_FUND_STATUS_DETAIL';
export const NavOversightDashboardPageCode = 'PAGE_DEFAULTS_NAV_DASHBOARD';
export const NavOversightDashboardDetailPageCode = 'PAGE_DEFAULTS_NAV_DETAIL';

export const HIERARCHY_DELIMITER = ':row:';

export const processingStatusPage = 'ProcessingStatus';
