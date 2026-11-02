import type { TranslateFn } from "@/lib/feedback/messages";

const EXACT_LABELS: Record<string, string> = {
  uid: "UID",
  vin: "VIN",
  sku: "SKU",
  qty: "Qty",
  name: "Name",
  active: "Active",
  email: "Email",
  notes: "Notes",
  phones: "Phones",
  branch: "Branch",
  address: "Address",
  user: "User",
  type: "Type",
  code: "Code",
  date: "Date",
  completed: "Completed",
  purpose: "Purpose",
  sender: "Sender",
  receiver: "Receiver",
  sector: "Sector",
  employee: "Employee",
  comments: "Comments",
  title: "Title",
  department: "Department",
  cost: "Cost",
  year: "Year",
  broker: "Broker",
  content: "Content",
  places: "Places",
  count: "Count",
  description: "Description",
  price: "Price",
  balance: "Balance",
  discount: "Discount",
  paid: "Paid",
  status: "Status",
  location: "Location",
  permissions: "Permissions",
  password: "Password",
  created: "Created at",
  departure: "Departure",
  arrival: "Arrival",
  container: "Container",
  barcode: "Barcode",
  labels: "Labels",
  invoice: "Invoice",
  vehicle: "Vehicle",
  employeeGroup: "Employee group",
  groupId: "Group ID",
  containerId: "Container ID",
  itemId: "Item ID",
  roleId: "Role ID",
  routeId: "Route ID",
  vehicleId: "Vehicle ID",
  route: "Route",
  employeeGroupId: "Employee group ID",
  invoiceId: "Invoice ID",
  labelId: "Label ID",
  customerType: "Customer type",
  receivers: "Receivers",
  accountBalance: "Account balance",
  IDNumber: "ID number",
  phone: "Phone",
  phone1: "Phone 1",
  "phones.number": "Phone",
  fuelType: "Fuel type",
  inspectionDate: "Inspection date",
  registrationDate: "Registration date",
  userName: "Username",
  fullName: "Full name",
  accessCode: "Access code",
  startTime: "Start time",
  endTime: "End time",
  startDate: "Start date",
  endDate: "End date",
  createdAt: "Created at",
  updatedAt: "Updated at",
  createdBy: "Created by",
  totalLoanGiven: "Total loan given",
  totalPaymentReceived: "Total payment received",
  loanAmountOwed: "Loan owed",
  loanBalanceUpdated: "Loan balance updated",
  address1: "Line 1",
  address2: "Line 2",
  apartment: "Apartment",
  city: "City",
  state: "State",
  zipcode: "Zip code",
  country: "Country",
  labelPrefix: "Label prefix",
};

const PARENT_LABELS: Record<string, string> = {
  branch: "Branch",
  address: "Address",
  role: "Role",
  user: "User",
  vehicle: "Vehicle",
  employeeGroup: "Employee group",
  settings: "Settings",
  sender: "Sender",
  receiver: "Receiver",
  sector: "Sector",
  customer: "Customer",
  order: "Order",
  employee: "Employee",
  route: "Route",
  assignment: "Assignment",
};

type ColumnLabelResolver = {
  exact: (key: string) => string | undefined;
  parent: (key: string) => string | undefined;
  word: (key: string) => string | undefined;
  idSuffix: (label: string) => string;
  nested: (parent: string, child: string) => string;
};

function readLabel(labels: Record<string, string>, key: string): string | undefined {
  return Object.hasOwn(labels, key) ? labels[key] : undefined;
}

const ENGLISH_RESOLVER: ColumnLabelResolver = {
  exact: (key) => readLabel(EXACT_LABELS, key),
  parent: (key) => readLabel(PARENT_LABELS, key),
  word: () => undefined,
  idSuffix: (label) => `${label} ID`,
  nested: (parent, child) => `${parent} ${child}`,
};

/** Lowercase the first letter unless the label starts with an acronym (`ID de…`, `SKU`). */
export function lowerFirstLetter(label: string): string {
  const second = label.charAt(1);
  if (second && second === second.toUpperCase() && second !== second.toLowerCase()) return label;
  return label.charAt(0).toLowerCase() + label.slice(1);
}

/** Resolves labels from `tableFields.columns.*`, falling back to the English maps. */
function createLocalizedResolver(t: TranslateFn): ColumnLabelResolver {
  function lookup(group: "exact" | "parent" | "words", key: string, english?: Record<string, string>) {
    if (english && !Object.hasOwn(english, key)) return undefined;
    const catalogKey = `tableFields.columns.${group}.${key}`;
    const localized = t(catalogKey);
    return localized === catalogKey ? english?.[key] : localized;
  }

  return {
    exact: (key) => lookup("exact", key, EXACT_LABELS),
    parent: (key) => lookup("parent", key, PARENT_LABELS),
    word: (key) => lookup("words", key),
    idSuffix: (label) => t("tableFields.columns.idSuffix", { label, labelLower: lowerFirstLetter(label) }),
    nested: (parent, child) =>
      t("tableFields.columns.nested", { parent, child, parentLower: lowerFirstLetter(parent) }),
  };
}

function isPresentableLabel(label: string): boolean {
  if (label.includes(" ")) return true;
  if (/^[A-Z0-9]{2,}$/.test(label)) return true;
  return false;
}

function titleCaseWords(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      if (lower === "id") return "ID";
      if (lower === "uid") return "UID";
      if (lower === "vin") return "VIN";
      if (lower === "sku") return "SKU";
      if (lower === "dr") return "DR";
      if (lower === "usa") return "USA";
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function splitIdentifier(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2")
    .trim();
}

function formatWord(value: string, resolver: ColumnLabelResolver): string {
  return resolver.word(value) ?? titleCaseWords(splitIdentifier(value));
}

function formatIdSuffixLabel(prefix: string, resolver: ColumnLabelResolver): string {
  const normalized = prefix.trim();
  if (!normalized) return "ID";
  return resolver.idSuffix(resolver.parent(normalized) ?? formatWord(normalized, resolver));
}

function formatSegment(segment: string, resolver: ColumnLabelResolver): string {
  const exact = resolver.exact(segment);
  if (exact) return exact;

  if (segment.endsWith("Id") && segment.length > 2) {
    return formatIdSuffixLabel(segment.slice(0, -2), resolver);
  }

  if (segment.endsWith("ID") && segment.length > 2) {
    return formatIdSuffixLabel(segment.slice(0, -2), resolver);
  }

  return formatWord(segment, resolver);
}

/**
 * Converts API-style column ids/labels into readable table header text.
 * Pass `t` to localize known ids via `tableFields.columns.*`; already-readable labels are returned as-is.
 */
export function formatTableColumnLabel(label: string, t?: TranslateFn): string {
  const resolver = t ? createLocalizedResolver(t) : ENGLISH_RESOLVER;
  const trimmed = label.trim();
  if (!trimmed) return trimmed;
  if (isPresentableLabel(trimmed)) return trimmed;
  const exact = resolver.exact(trimmed);
  if (exact) return exact;

  if (trimmed.includes(".")) {
    const segments = trimmed.split(".");

    if (segments[segments.length - 1] === "id" && segments.length >= 2) {
      const parentSegments = segments.slice(0, -1);
      const parentLabel =
        (parentSegments.length === 1 ? resolver.parent(parentSegments[0]!) : undefined) ??
        parentSegments
          .map((segment) => formatSegment(segment, resolver))
          .reduce((parent, child) => resolver.nested(parent, child));
      return resolver.idSuffix(parentLabel);
    }

    const formatted = segments.map((segment, index) => {
      const parent = index === 0 && segments.length > 1 ? resolver.parent(segment) : undefined;
      return parent ?? formatSegment(segment, resolver);
    });

    const twoSegmentParent = segments.length === 2 ? resolver.parent(segments[0]!) : undefined;
    if (twoSegmentParent) {
      const child = formatSegment(segments[1]!, resolver);
      if (child.toLowerCase().startsWith(twoSegmentParent.toLowerCase())) return child;
    }

    return formatted.reduce((parent, child) => resolver.nested(parent, child));
  }

  return formatSegment(trimmed, resolver);
}
