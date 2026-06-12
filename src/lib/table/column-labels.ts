const EXACT_LABELS: Record<string, string> = {
  oldID: "Old ID",
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
  created: "Created",
  departure: "Departure",
  arrival: "Arrival",
  container: "Container",
  barcode: "Barcode",
  labels: "Labels",
  invoice: "Invoice",
  truck: "Truck",
  employeeGroup: "Employee group",
  groupId: "Group ID",
  containerId: "Container ID",
  itemId: "Item ID",
  roleId: "Role ID",
  routeId: "Route ID",
  truckId: "Truck ID",
  routeAssignmentId: "Route assignment",
  routeAssignment: "Route assignment",
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
  userName: "Username",
  fullName: "Full name",
  accessCode: "Access code",
  startTime: "Start time",
  endTime: "End time",
  startDate: "Start date",
  endDate: "End date",
  createdAt: "Created",
  updatedAt: "Updated",
  createdBy: "Created by",
  createdByID: "Created by",
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
  truck: "Truck",
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

function formatIdSuffixLabel(prefix: string): string {
  const normalized = prefix.trim();
  if (!normalized) return "ID";
  if (PARENT_LABELS[normalized]) return `${PARENT_LABELS[normalized]} ID`;
  return `${titleCaseWords(splitIdentifier(normalized))} ID`;
}

function formatSegment(segment: string): string {
  if (EXACT_LABELS[segment]) return EXACT_LABELS[segment];

  if (segment.endsWith("Id") && segment.length > 2) {
    return formatIdSuffixLabel(segment.slice(0, -2));
  }

  if (segment.endsWith("ID") && segment.length > 2) {
    return formatIdSuffixLabel(segment.slice(0, -2));
  }

  return titleCaseWords(splitIdentifier(segment));
}

/** Converts API-style column ids/labels into readable table header text. */
export function formatTableColumnLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return trimmed;
  if (isPresentableLabel(trimmed)) return trimmed;
  if (EXACT_LABELS[trimmed]) return EXACT_LABELS[trimmed];

  if (trimmed.includes(".")) {
    const segments = trimmed.split(".");

    if (segments[segments.length - 1] === "id" && segments.length >= 2) {
      const parentSegments = segments.slice(0, -1);
      const parentLabel =
        parentSegments.length === 1 && PARENT_LABELS[parentSegments[0]!]
          ? PARENT_LABELS[parentSegments[0]!]
          : parentSegments.map((segment) => formatSegment(segment)).join(" ");
      return `${parentLabel} ID`;
    }

    const formatted = segments.map((segment, index) => {
      if (index === 0 && segments.length > 1 && PARENT_LABELS[segment]) {
        return PARENT_LABELS[segment];
      }
      return formatSegment(segment);
    });

    if (segments.length === 2 && PARENT_LABELS[segments[0]!]) {
      const child = formatSegment(segments[1]!);
      const childLower = child.toLowerCase();
      const parentLower = PARENT_LABELS[segments[0]!]!.toLowerCase();
      if (childLower.startsWith(parentLower)) return child;
    }

    return formatted.join(" ");
  }

  return formatSegment(trimmed);
}
