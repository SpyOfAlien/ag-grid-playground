import type {
  ICombinedSimpleModel,
  IServerSideDatasource,
  IServerSideGetRowsParams,
  TextFilterModel,
} from 'ag-grid-community';
import { REVISION_COL_ID } from './columns/build-signal-column-defs';
import type { SignalColumn, SignalGroup, SignalRow } from './signal.model';

/**
 * The groups of the Figma frame (Signal List Management, node 1814:107892), with one more level
 * under RIC/CABINET so a level-2 group shows that every level below the outermost shares its
 * colours.
 */
export const SIGNAL_GROUPS: SignalGroup[] = [
  { code: 'geA', name: 'For GE Internal Data', parentCode: null, orderNo: 6 },
  { code: 'hmi', name: 'For HMI Engineering', parentCode: null, orderNo: 7 },
  { code: 'hmiGe', name: 'For GE Internal Data', parentCode: 'hmi', orderNo: 1 },
  { code: 'hmiOutput', name: 'For Output Data', parentCode: 'hmi', orderNo: 2 },
  { code: 'ric', name: 'RIC/CABINET', parentCode: 'hmi', orderNo: 3 },
  { code: 'wiring', name: 'Terminal Wiring Details', parentCode: 'ric', orderNo: 3 },
  { code: 'geB', name: 'For GE Internal Data', parentCode: null, orderNo: 8 },
  {
    code: 'protection',
    name: 'For Protection & Control Engineering',
    parentCode: null,
    orderNo: 9,
  },
  { code: 'trip', name: 'Trip Matrix', parentCode: 'protection', orderNo: 2 },
  { code: 'scada', name: 'For SCADA Integration', parentCode: null, orderNo: 11 },
  { code: 'scadaPoints', name: 'Point Mapping', parentCode: 'scada', orderNo: 3 },
  { code: 'scadaAlarms', name: 'Alarm Classification & Priority', parentCode: 'scada', orderNo: 4 },
  { code: 'commissioning', name: 'For Commissioning & Testing', parentCode: null, orderNo: 12 },
  { code: 'fat', name: 'Factory Acceptance Test', parentCode: 'commissioning', orderNo: 2 },
  { code: 'sat', name: 'Site Acceptance Test', parentCode: 'commissioning', orderNo: 3 },
  // Long names, to see how they wrap in open headers and run down rails.
  {
    code: 'documentation',
    name: 'For Engineering Documentation, Drawing References & Revision Control',
    parentCode: null,
    orderNo: 14,
  },
  {
    code: 'crossReference',
    name: 'Cross-Reference to Single Line Diagram and Protection Schematic Sheets',
    parentCode: 'documentation',
    orderNo: 3,
  },
  {
    code: 'verification',
    name: 'Design Verification, Customer Approval and Final As-Built Sign-off Records',
    parentCode: 'crossReference',
    orderNo: 3,
  },
  // 20 more columns, to scroll further sideways and collapse into more rails.
  { code: 'cable', name: 'For Cable Schedule', parentCode: null, orderNo: 16 },
  {
    code: 'cableRoute',
    name: 'Cable Routing & Tray Allocation',
    parentCode: 'cable',
    orderNo: 9,
  },
  {
    code: 'cableTest',
    name: 'Insulation & Continuity Test Results',
    parentCode: 'cableRoute',
    orderNo: 7,
  },
];

export const SIGNAL_COLUMNS: SignalColumn[] = [
  { code: 'signalType', name: 'Signal Type', groupCode: null, orderNo: 1 },
  { code: 'areaRef', name: 'Area Ref/Bay.', groupCode: null, orderNo: 2, selectFilter: true },
  { code: 'areaShort', name: 'Area Ref/Bay Ref Short Name', groupCode: null, orderNo: 3 },
  { code: 'sldName', name: 'SLD Equipment Name', groupCode: null, orderNo: 4 },
  { code: 'equipmentType', name: 'Equipment Type', groupCode: null, orderNo: 5 },
  { code: 'internalCode', name: 'Internal Code', groupCode: 'geA', orderNo: 1 },
  { code: 'panelRef', name: 'Panel Ref', groupCode: 'geA', orderNo: 2 },
  { code: 'geTag', name: 'GE Tag', groupCode: 'hmiGe', orderNo: 1 },
  { code: 'geObject', name: 'GE Object Ref', groupCode: 'hmiGe', orderNo: 2 },
  { code: 'outputType', name: 'Output Type', groupCode: 'hmiOutput', orderNo: 1 },
  { code: 'outputAddress', name: 'Output Address', groupCode: 'hmiOutput', orderNo: 2 },
  { code: 'ricA', name: 'RIC A Terminal Ref', groupCode: 'ric', orderNo: 1 },
  { code: 'ricB', name: 'RIC B Terminal Ref', groupCode: 'ric', orderNo: 2 },
  { code: 'terminalBlock', name: 'Terminal Block', groupCode: 'wiring', orderNo: 1 },
  { code: 'wireNo', name: 'Wire Number', groupCode: 'wiring', orderNo: 2 },
  { code: 'logicNode', name: 'Logic Node', groupCode: 'geB', orderNo: 1 },
  { code: 'dataObject', name: 'Data Object', groupCode: 'geB', orderNo: 2 },
  { code: 'relayFunction', name: 'Relay Function', groupCode: 'protection', orderNo: 1 },
  { code: 'tripOutput', name: 'Trip Output', groupCode: 'trip', orderNo: 1 },
  { code: 'breakerRef', name: 'Breaker Ref', groupCode: 'trip', orderNo: 2 },
  { code: 'panelRow', name: 'Panel Row', groupCode: 'geA', orderNo: 3 },
  { code: 'panelColumn', name: 'Panel Column', groupCode: 'geA', orderNo: 4 },
  { code: 'geDataset', name: 'GE Dataset', groupCode: 'hmiGe', orderNo: 3 },
  { code: 'outputScale', name: 'Output Scale', groupCode: 'hmiOutput', orderNo: 3 },
  { code: 'ricC', name: 'RIC C Terminal Ref', groupCode: 'ric', orderNo: 4 },
  { code: 'cableNo', name: 'Cable Number', groupCode: 'wiring', orderNo: 3 },
  { code: 'attribute', name: 'Data Attribute', groupCode: 'geB', orderNo: 3 },
  { code: 'tripDelay', name: 'Trip Delay', groupCode: 'trip', orderNo: 3 },
  { code: 'remarks', name: 'Remarks', groupCode: null, orderNo: 10 },
  { code: 'scadaTag', name: 'SCADA Tag', groupCode: 'scada', orderNo: 1 },
  { code: 'scadaDescription', name: 'SCADA Description', groupCode: 'scada', orderNo: 2 },
  { code: 'iec104Address', name: 'IEC 104 Address', groupCode: 'scadaPoints', orderNo: 1 },
  { code: 'dnpIndex', name: 'DNP3 Index', groupCode: 'scadaPoints', orderNo: 2 },
  { code: 'alarmClass', name: 'Alarm Class', groupCode: 'scadaAlarms', orderNo: 1 },
  { code: 'alarmPriority', name: 'Alarm Priority', groupCode: 'scadaAlarms', orderNo: 2 },
  { code: 'testEngineer', name: 'Test Engineer', groupCode: 'commissioning', orderNo: 1 },
  { code: 'fatResult', name: 'FAT Result', groupCode: 'fat', orderNo: 1 },
  { code: 'fatDate', name: 'FAT Date', groupCode: 'fat', orderNo: 2 },
  { code: 'satResult', name: 'SAT Result', groupCode: 'sat', orderNo: 1 },
  { code: 'satDate', name: 'SAT Date', groupCode: 'sat', orderNo: 2 },
  { code: 'comments', name: 'Comments', groupCode: null, orderNo: 13 },
  {
    code: 'customerDescription',
    name: 'Signal Description According to the Customer Specification Document',
    groupCode: 'documentation',
    orderNo: 1,
  },
  {
    code: 'interlocking',
    name: 'Interlocking Logic Description for the Breaker Close Permissive Condition',
    groupCode: 'documentation',
    orderNo: 2,
  },
  {
    code: 'sldDrawing',
    name: 'Drawing Number of the Associated Single Line Diagram',
    groupCode: 'crossReference',
    orderNo: 1,
  },
  {
    code: 'schematicSheet',
    name: 'Protection Schematic Sheet Reference (Primary and Backup Protection)',
    groupCode: 'crossReference',
    orderNo: 2,
  },
  {
    code: 'verifiedBy',
    name: 'Responsible Engineer for the Final Design Verification',
    groupCode: 'verification',
    orderNo: 1,
  },
  {
    code: 'approvalComment',
    name: 'Customer Approval Comment Recorded During the Design Review Meeting',
    groupCode: 'verification',
    orderNo: 2,
  },
  {
    code: 'maintenanceNote',
    name: 'Long-Term Maintenance Note for the Operations and Asset Management Team',
    groupCode: null,
    orderNo: 15,
  },
  { code: 'cableId', name: 'Cable ID', groupCode: 'cable', orderNo: 1 },
  { code: 'cableType', name: 'Cable Type', groupCode: 'cable', orderNo: 2 },
  { code: 'cores', name: 'Number of Cores', groupCode: 'cable', orderNo: 3 },
  { code: 'crossSection', name: 'Conductor Cross Section', groupCode: 'cable', orderNo: 4 },
  { code: 'cableLength', name: 'Cable Length', groupCode: 'cable', orderNo: 5 },
  { code: 'fromDevice', name: 'From Device', groupCode: 'cable', orderNo: 6 },
  { code: 'toDevice', name: 'To Device', groupCode: 'cable', orderNo: 7 },
  { code: 'glandSize', name: 'Gland Size', groupCode: 'cable', orderNo: 8 },
  { code: 'trayId', name: 'Tray ID', groupCode: 'cableRoute', orderNo: 1 },
  { code: 'trayLevel', name: 'Tray Level', groupCode: 'cableRoute', orderNo: 2 },
  { code: 'routeSegment', name: 'Route Segment', groupCode: 'cableRoute', orderNo: 3 },
  { code: 'fireZone', name: 'Fire Zone', groupCode: 'cableRoute', orderNo: 4 },
  { code: 'segregation', name: 'Segregation Class', groupCode: 'cableRoute', orderNo: 5 },
  { code: 'trench', name: 'Trench Reference', groupCode: 'cableRoute', orderNo: 6 },
  { code: 'irValue', name: 'Insulation Resistance', groupCode: 'cableTest', orderNo: 1 },
  { code: 'testVoltage', name: 'Test Voltage', groupCode: 'cableTest', orderNo: 2 },
  { code: 'continuity', name: 'Continuity Check', groupCode: 'cableTest', orderNo: 3 },
  { code: 'testedBy', name: 'Tested By', groupCode: 'cableTest', orderNo: 4 },
  { code: 'testDate', name: 'Test Date', groupCode: 'cableTest', orderNo: 5 },
  { code: 'testResult', name: 'Test Result', groupCode: 'cableTest', orderNo: 6 },
];

/** Open in the Figma frame (plus the extra SCADA group, to have more to scroll past). */
export const INITIALLY_OPEN_GROUPS: ReadonlySet<string> = new Set(['hmi', 'ric', 'scada']);

/** Changes skip the first GE group, so its rail shows the empty badge. */
const CODES = SIGNAL_COLUMNS.filter(({ groupCode }) => groupCode !== 'geA').map(({ code }) => code);

function signalRow(index: number): SignalRow {
  const n = index + 1;
  const bay = `=T${(n % 3) + 1}_W${(n % 2) + 1}_ACF`;
  const values: Record<string, string> = {
    signalType: ['Wired Input', 'Wired Output', 'GOOSE Input'][n % 3],
    areaRef: bay,
    areaShort: 'ACF',
    sldName: String(20 + (n % 8)),
    equipmentType: ['Circuit Breaker', 'Disconnector', 'Earth Switch'][n % 3],
    internalCode: `GE-${3000 + n}`,
    panelRef: `P1A_TRA_${(n % 4) + 1}`,
    geTag: `TAG_${100 + n}`,
    geObject: `LD0/GGIO${(n % 5) + 1}`,
    outputType: n % 2 ? 'Binary' : 'Analog',
    outputAddress: `0x${(0x1a0 + n).toString(16).toUpperCase()}`,
    ricA: String(24 + (n % 3)),
    ricB: String(24 + (n % 2)),
    terminalBlock: `X${(n % 6) + 1}`,
    wireNo: `W-${400 + n}`,
    logicNode: ['XCBR1', 'CSWI1', 'PTOC1'][n % 3],
    dataObject: ['Pos', 'Op', 'Str'][n % 3],
    relayFunction: ['50/51', '87T', '21'][n % 3],
    tripOutput: `TR${(n % 4) + 1}`,
    breakerRef: `CB-${10 + (n % 7)}`,
    remarks: n % 6 ? '' : 'Check at next shutdown',
    panelRow: String.fromCharCode(65 + (n % 5)),
    panelColumn: String((n % 8) + 1),
    geDataset: `DS_${(n % 3) + 1}`,
    outputScale: n % 2 ? '1:1' : '1:10',
    ricC: String(23 + (n % 4)),
    cableNo: `C-${700 + n}`,
    attribute: ['stVal', 'q', 't'][n % 3],
    tripDelay: `${(n % 5) * 20} ms`,
    scadaTag: `SC_${5000 + n}`,
    scadaDescription: n % 2 ? 'Breaker position' : 'Protection trip',
    iec104Address: String(4000 + n),
    dnpIndex: String(n % 128),
    alarmClass: ['Info', 'Warning', 'Critical'][n % 3],
    alarmPriority: String((n % 4) + 1),
    testEngineer: n % 2 ? 'Hai Le' : 'Minh Tran',
    fatResult: n % 7 ? 'Pass' : 'Fail',
    fatDate: `2026-0${(n % 9) + 1}-12`,
    satResult: n % 9 ? 'Pass' : 'Pending',
    satDate: `2026-0${(n % 9) + 1}-24`,
    comments: n % 5 ? '' : 'Retest after rewiring',
    customerDescription: n % 2 ? 'Circuit breaker closed position' : 'Trip circuit supervision',
    interlocking: n % 3 ? 'Disconnectors closed, earth switch open' : 'Bus coupler closed',
    sldDrawing: `SLD-P1A-${String(100 + (n % 12)).padStart(4, '0')}`,
    schematicSheet: `SCH-${(n % 9) + 1}/${(n % 4) + 10}`,
    verifiedBy: n % 2 ? 'Hai Le' : 'Minh Tran',
    approvalComment: n % 4 ? 'Approved' : 'Approved with comments',
    maintenanceNote: n % 7 ? '' : 'Replace auxiliary relay at next outage',
    cableId: `CBL-${String(1000 + n)}`,
    cableType: ['NYY', 'NYCY', 'LiYCY'][n % 3],
    cores: String([2, 4, 7, 12][n % 4]),
    crossSection: `${[1.5, 2.5, 4, 6][n % 4]} mm²`,
    cableLength: `${20 + ((n * 7) % 180)} m`,
    fromDevice: `P1A_TRA_C${30 + (n % 5)}`,
    toDevice: `MK-${(n % 9) + 1}`,
    glandSize: ['M20', 'M25', 'M32'][n % 3],
    trayId: `TR-${(n % 12) + 1}`,
    trayLevel: String((n % 3) + 1),
    routeSegment: `S${(n % 6) + 1}-S${(n % 6) + 2}`,
    fireZone: `FZ-${(n % 4) + 1}`,
    segregation: ['Power', 'Control', 'Signal'][n % 3],
    trench: n % 5 ? `TRN-${(n % 3) + 1}` : '',
    irValue: `${100 + ((n * 13) % 900)} MΩ`,
    testVoltage: n % 2 ? '500 V' : '1000 V',
    continuity: n % 9 ? 'OK' : 'Open',
    testedBy: n % 2 ? 'Hai Le' : 'Minh Tran',
    testDate: `2026-0${(n % 9) + 1}-1${n % 10}`,
    testResult: n % 9 ? 'Pass' : 'Fail',
  };
  // Every third row has changes, spread over a few groups.
  const modifiedCodes = n % 3 === 1 ? [CODES[n % CODES.length], CODES[(n * 7) % CODES.length]] : [];
  return { signalId: `signal-${n}`, revisionLabel: 'A**', data: values, modifiedCodes };
}

export const SIGNAL_ROWS: SignalRow[] = Array.from({ length: 60 }, (_, index) => signalRow(index));

/** A cell's text as the backend sees it; Revision is a row field, not a data column. */
const cellText = (row: SignalRow, colId: string): string =>
  (colId === REVISION_COL_ID ? row.revisionLabel : row.data[colId]) ?? '';

/** One condition of AG Grid's text filter, as the backend would apply it. */
function matchesCondition(text: string, { type, filter }: TextFilterModel): boolean {
  const value = text.toLowerCase();
  const term = String(filter ?? '').toLowerCase();
  switch (type) {
    case 'equals':
      return value === term;
    case 'notEqual':
      return value !== term;
    case 'startsWith':
      return value.startsWith(term);
    case 'endsWith':
      return value.endsWith(term);
    case 'notContains':
      return !value.includes(term);
    case 'blank':
      return value === '';
    case 'notBlank':
      return value !== '';
    default:
      return value.includes(term);
  }
}

/** A column's filter: one condition, or two joined by AND / OR from the full filter. */
function matchesFilter(
  text: string,
  model: TextFilterModel | ICombinedSimpleModel<TextFilterModel>,
) {
  if ('conditions' in model && model.conditions) {
    const results = model.conditions.map((condition) => matchesCondition(text, condition));
    return model.operator === 'OR' ? results.some(Boolean) : results.every(Boolean);
  }
  return matchesCondition(text, model as TextFilterModel);
}

/**
 * Stand-in for the signal API: filters and sorts the rows the way the backend would, then
 * serves the requested block a moment later.
 */
export function createSignalDatasource(
  rows: () => readonly SignalRow[],
): IServerSideDatasource<SignalRow> {
  return {
    getRows(params: IServerSideGetRowsParams<SignalRow>) {
      const { startRow = 0, endRow = 100, filterModel, sortModel } = params.request;
      const filters = Object.entries(
        (filterModel ?? {}) as Record<
          string,
          TextFilterModel | ICombinedSimpleModel<TextFilterModel>
        >,
      );
      const matching = rows().filter((row) =>
        filters.every(([colId, model]) => matchesFilter(cellText(row, colId), model)),
      );
      const sorted = sortModel.length
        ? [...matching].sort((a, b) => {
            for (const { colId, sort } of sortModel) {
              const order = cellText(a, colId).localeCompare(cellText(b, colId), undefined, {
                numeric: true,
              });
              if (order !== 0) return sort === 'asc' ? order : -order;
            }
            return 0;
          })
        : matching;
      setTimeout(() =>
        params.success({ rowData: sorted.slice(startRow, endRow), rowCount: sorted.length }),
      );
    },
  };
}

/** The distinct values of a column, for its select filter. */
export function columnOptions(code: string): string[] {
  return [...new Set(SIGNAL_ROWS.map((row) => row.data[code] ?? ''))]
    .filter((value) => value !== '')
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
