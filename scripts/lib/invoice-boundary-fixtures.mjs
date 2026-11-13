import {createPortalLoader, createHttpApiClient} from "./portal-modules.mjs";

/** Own invoice/container/routes only; no existing period or shipping record is mutated. */
export async function verifyInvoiceBoundaries({request, branch, closeout, marker, create, verify, evidence, note, uploadDocument, lifecycleOnly = false}) {
  let invoiceId;
  const load = createPortalLoader({apiClient: createHttpApiClient(async (method, path, body, headers) => {
    const result = await request(method, path, body, headers);
    if (method === "POST" && path === "/invoices") {
      invoiceId = result.json?.data?.id;
      evidence.push({label: "Portal invoice create boundary", branch: body.branch, date: body.date, actorBranch: branch, http: result.status, response: result.json});
    }
    if (method === "PUT" && path.startsWith("/invoices/")) evidence.push({label: "Portal embedded invoice update boundary", http: result.status, version: headers?.["If-Match"], piece: body.invoiceDetails?.[0]?.barcodes?.[0], error: result.json?.error});
    return result;
  })});
  const api = load("src/lib/invoices/api/invoices-api.ts");
  const types = load("src/lib/invoices/types.ts");
  const customerTypes = load("src/lib/customers/types.ts");
  const customerIds = new Set();
  const catalogIds = new Set();
  let registrationId;
  try {
    // Invoice numbering requires the existing sequence-year container convention.
    // The booking and physical reference retain the unique audit marker.
    const container = await create("/containers", {name: `${90000 + branch.id}-${String(new Date().getUTCFullYear()).slice(-2)}`, booking: marker, containerNumber: marker.slice(-12), sealNumber: marker.slice(-12), cost: 0, departureDate: new Date().toISOString(), arrivalDate: new Date(Date.now() + 86400000).toISOString()});
    const emptyCustomer = customerTypes.createEmptyCustomerForm();
    const customer = {...emptyCustomer, name: `${marker}-SENDER`, customerType: 1, branch, phones: [{type: "mobile", number: "+12025550103", isPrimary: true}], addresses: [{...emptyCustomer.addresses[0], address1: "1 Fixture St", city: "Bronx", state: "NY", zipcode: "10451", country: "US", isPrimary: true}]};
    const values = {...types.createEmptyInvoiceForm(), autoGenerateNumber: false, invoiceNumber: marker, date: String(closeout.businessDate ?? closeout.date).slice(0,10), sender: customer, receiver: null, amountPaid: "0", discount: "0", lineItems: [{...types.createEmptyInvoiceLineItem(), itemName: marker, quantity: "200", labelCount: "200", unitPrice: "0.01", lineTotal: "2.00"}]};
    const context = {branch, container: {id: container.id, name: container.name}};
    let invoice;
    try { invoice = await api.createInvoice(values, context); }
    catch (error) {
      if (error.response?.status !== 400 || !/branch/i.test(error.message)) throw error;
      verify("Ordinary portal invoice creation accepts its documented branch", false, {status: error.response.status, json: error.response.data});
      note("Ordinary creation blocked by branch contract; use the portal's unpaid registration/completion lifecycle for remaining isolated checks.");
      const registered = await load("src/lib/accounting/daily-income/api.ts").createDailyIncomeJournalSync(crypto.randomUUID(), {...closeout, branch, currency: "USD", rate: 1}, {transactionType: "INITIAL-PAYMENT", invoiceNumber: marker, invoiceCost: 2, invoiceDiscount: 0, amount: 0, paymentMethodName: "CASH", description: marker});
      registrationId = registered.id;
      invoiceId = String(registered.invoice?.id ?? "");
      if (!invoiceId) throw new Error("Registration did not return invoice identity");
      const pending = await request("GET", `/invoices/${invoiceId}`);
      invoice = await api.updateInvoice(invoiceId, {...values, invoiceId, version: pending.json.data.version}, {...context, registeredInvoiceTotals: {cost: 2, payment: 0, balance: 2}});
      evidence.push({label: "Unpaid registration/completion", registrationId, invoiceId});
    }
    invoiceId = invoice.invoiceId;
    evidence.push({label: "Created invoice through real portal adapter", invoiceId});
    verify("Real portal invoice create succeeds in its own current branch", Boolean(invoiceId));
    async function read() {
      const result = await request("GET", `/invoices/${invoiceId}`);
      if (result.status !== 200) throw new Error("Invoice read failed");
      const row = result.json.data;
      for (const party of [row.sender, row.receiver]) if (party?.id && party.name?.startsWith(marker)) customerIds.add(party.id);
      return row;
    }
    const initial = await read();
    const pieces = initial.invoiceDetails?.flatMap(detail => detail.barcodes ?? []) ?? [];
    let ids = pieces.map(piece => piece.id).filter(id => Number.isInteger(id) && id > 0);
    evidence.push({label: "Generated invoice piece shape", count: pieces.length, sample: pieces[0], version: initial.version});
    verify("Invoice generates 200 distinct numeric piece IDs", ids.length === 200 && new Set(ids).size === 200);
    verify("New invoice pieces receive the documented ALM-NY default status", pieces.length === 200 && pieces.every(piece => piece.status?.name === "ALM-NY"));
    if (ids.length !== 200) throw new Error("Cannot establish invoice piece controls");
    const routes = await request("POST", "/vehicle-routes/search", {pagination: {page: 1, limit: 30}, sort: [{field: "date", direction: "desc"}]});
    const sample = routes.json?.data?.find(row => row.routeType === "delivery" && row.vehicle?.id && row.driver?.id && row.supervisor?.id && row.branch?.id);
    if (!sample) throw new Error("No bounded delivery route prerequisites");
    const date = new Date(); date.setUTCFullYear(date.getUTCFullYear() + 3); date.setUTCDate(date.getUTCDate() + Number(branch.id));
    const routeBody = {...sample, id: undefined, name: undefined, branch, date: date.toISOString().slice(0,10) + "T00:00:00Z", container: {id: container.id, number: container.name}, active: true};
    evidence.push({label: "Owned invoice route request", body: routeBody});
    const route = await create("/vehicle-routes", routeBody);
    const routeReadback = await request("GET", `/vehicle-routes/${route.id}`);
    evidence.push({label: "Owned invoice route readback", http: routeReadback.status, response: routeReadback.json, invoiceBranch: initial.branch, invoiceContainer: initial.container, samplePiece: pieces[0]});
    if (!lifecycleOnly) {
    const path = `/invoices/item/barcode/route/${route.id}`;
    const catalogControl = await request("POST", "/barcodes/search", {filters: [{field: "number", operator: "startsWith", value: pieces[0].number.slice(0, -4)}], pagination: {page: 1, limit: 200}});
    const catalogPieces = catalogControl.json?.data ?? [];
    evidence.push({label: "Catalog versus embedded piece identity", http: catalogControl.status, total: catalogControl.json?.total, rows: catalogPieces.map(row => ({id: row.id, barcodeId: row.barcodeId, number: row.number, invoice: row.invoice}))});
    if (catalogControl.status !== 200 || catalogPieces.length !== 200 || catalogPieces.some(row => !pieces.some(piece => piece.barcodeId === row.barcodeId && piece.number === row.number))) throw Error("Owned catalog ID mapping not established");
    const catalogIdsForAssignment = catalogPieces.map(row => row.id);
    const catalogAssignment = await request("PUT", path, {barcodeIds: [catalogIdsForAssignment[0]]});
    evidence.push({label: "Catalog-ID assignment positive control", body: {barcodeIds: [catalogIdsForAssignment[0]]}, http: catalogAssignment.status, response: catalogAssignment.json});
    const catalogAssigned = (await read()).invoiceDetails.flatMap(detail => detail.barcodes ?? []).find(piece => piece.barcodeId === catalogPieces[0].barcodeId);
    if (catalogAssignment.status >= 200 && catalogAssignment.status < 300 && catalogAssigned?.route?.id === route.id) {
      ids = catalogIdsForAssignment;
      note("Live numeric bulk assignment resolves catalog IDs, which differ from invoice-local piece sequences; using confirmed owned catalog IDs for this matrix.");
    }
    const state = row => JSON.stringify(row.invoiceDetails?.flatMap(detail => detail.barcodes ?? []).map(piece => ({id: piece.id, route: piece.route, deliveryId: piece.deliveryId, tripNumber: piece.tripNumber})));
    const before = state(await read());
    for (const [label, barcodeIds, expected] of [["empty", [], 400], ["duplicate", [ids[0], ids[0]], 400], ["201 pieces", [...ids, 4294967295], 400], ["missing numeric ID mixed with valid", [ids[0], 4294967295], 404]]) {
      const result = await request("PUT", path, {barcodeIds});
      evidence.push({label: `Invoice bulk ${label}`, http: result.status, response: result.json});
      verify(`Invoice bulk rejects ${label}`, result.status === expected, result);
      verify(`Rejected ${label} leaves every piece unchanged`, state(await read()) === before);
    }
    const assigned = await request("PUT", path, {barcodeIds: ids});
    verify("API assigns 200 invoice pieces", assigned.status >= 200 && assigned.status < 300 && assigned.json.data?.assignedCount === 200, assigned);
    const assignedRow = await read();
    verify("All selected invoice pieces persist target route", assignedRow.invoiceDetails.flatMap(detail => detail.barcodes ?? []).every(piece => piece.route?.id === route.id));
    const replay = await request("PUT", path, {barcodeIds: ids});
    verify("Successful invoice bulk replay is accepted", replay.status >= 200 && replay.status < 300, replay);
    evidence.push({label: "Invoice bulk replay response", response: replay.json});
    }
    // Exercise the real embedded adapter independently of bulk assignment.
    try {
      const statuses = await request("GET", "/barcode-statuses?page=1&limit=30");
      const conduce = statuses.json?.data?.find(status => status.id === 6 && /CONDUCE/i.test(status.name));
      if (!conduce) throw Error("CONDUCE status control unavailable");
      const piece = pieces[0];
      const patch = {barcodeId: piece.barcodeId, number: piece.number, status: {id: conduce.id, name: conduce.name}, route: {id: route.id, name: route.name}};
      await api.patchInvoiceEmbeddedBarcodes(invoiceId, [patch]);
      const assignedPiece = (await read()).invoiceDetails.flatMap(detail => detail.barcodes ?? []).find(row => row.barcodeId === piece.barcodeId);
      evidence.push({label: "Embedded CONDUCE assignment", piece: assignedPiece});
      verify("Embedded CONDUCE assignment persists route", assignedPiece?.route?.id === route.id);
      verify("Embedded update persists requested CONDUCE status", assignedPiece?.status?.id === 6);
      await api.patchInvoiceEmbeddedBarcodes(invoiceId, [{...patch, route: null}]);
      const removedPiece = (await read()).invoiceDetails.flatMap(detail => detail.barcodes ?? []).find(row => row.barcodeId === piece.barcodeId);
      evidence.push({label: "Embedded CONDUCE removal", piece: removedPiece});
      verify("Embedded removal clears route and preserves saved status/container/delivery identity", !removedPiece?.route?.id && JSON.stringify(removedPiece?.status) === JSON.stringify(assignedPiece?.status) && removedPiece?.container?.id === assignedPiece?.container?.id && JSON.stringify(removedPiece?.delivery) === JSON.stringify(assignedPiece?.delivery) && removedPiece?.deliveryId === assignedPiece?.deliveryId);
      const catalog = await request("POST", "/barcodes/search", {filters: [{field: "number", operator: "eq", value: piece.number}], pagination: {page: 1, limit: 2}});
      evidence.push({label: "Embedded removal catalog readback", http: catalog.status, response: catalog.json});
      verify("Embedded removal synchronizes catalog route and saved status", catalog.status === 200 && catalog.json?.data?.length === 1 && !catalog.json.data[0].route?.id && JSON.stringify(catalog.json.data[0].status) === JSON.stringify(removedPiece?.status));
    } catch (error) {
      evidence.push({label: "Embedded lifecycle error", message: error.message, http: error.response?.status, response: error.response?.data});
      verify("Embedded route lifecycle completes", false, {status: error.response?.status ?? 0, json: error.response?.data ?? {message: error.message}});
    }
    if (uploadDocument) {
      let document;
      try {
        const uploaded = await uploadDocument(invoiceId);
        evidence.push({label: "Private fixture document upload", http: uploaded.status, response: uploaded.json});
        verify("Private fixture invoice document uploads", uploaded.status >= 200 && uploaded.status < 300, uploaded);
        document = uploaded.json?.data;
        if (!document?.id) throw Error("No document identity returned");
        const beforeDelete = await read();
        const blocked = await request("DELETE", `/invoices/${invoiceId}`, undefined, {"If-Match": `"${beforeDelete.version}"`});
        evidence.push({label: "Invoice deletion with attached document", http: blocked.status, response: blocked.json});
        verify("Attached document prevents invoice deletion and preserves invoice version", blocked.status === 409 && (await read()).version === beforeDelete.version, blocked);
        const listed = await request("GET", `/invoices/${invoiceId}/documents`);
        evidence.push({label: "Document survives rejected invoice deletion", http: listed.status, response: listed.json});
        verify("Rejected invoice deletion retains its document metadata", listed.status === 200 && listed.json?.data?.items?.some(row => row.id === document.id));
      } finally {
        if (document?.id) {
          const deleted = await request("DELETE", `/invoices/${invoiceId}/documents/${document.id}`, undefined, {"If-Match": String(document.version)});
          verify("Private fixture document removed before invoice cleanup", deleted.status === 200, deleted);
        }
      }
    }
    const missingVersion = await request("DELETE", `/invoices/${invoiceId}`);
    verify("Invoice delete rejects a missing version", [400, 412, 428].includes(missingVersion.status), missingVersion);
    const wrongVersion = await request("DELETE", `/invoices/${invoiceId}`, undefined, {"If-Match": `"v1:${"0".repeat(64)}"`});
    verify("Invoice delete rejects stale version", [409, 412].includes(wrongVersion.status), wrongVersion);
  } finally {
    if (invoiceId) {
      const list = await request("POST", "/barcodes/search", {filters: [{field: "number", operator: "startsWith", value: marker}], pagination: {page: 1, limit: 200}});
      for (const row of list.json?.data ?? []) if (row.number?.startsWith(marker) && row.id != null) catalogIds.add(row.id);
      const row = await request("GET", `/invoices/${invoiceId}`);
      if (row.json?.data?.version) {
        const result = await request("DELETE", `/invoices/${invoiceId}`, undefined, {"If-Match": `"${row.json.data.version}"`});
        verify("Own invoice deletes with current version", result.status >= 200 && result.status < 300, result);
        if (!(result.status >= 200 && result.status < 300)) note(`Retained invoice ${invoiceId}`);
      }
    }
    if (registrationId) {
      const journal = await request("GET", `/journals/${registrationId}`);
      evidence.push({label: "Retained unpaid $2 invoice registration audit", id: registrationId, http: journal.status});
      note(`Unpaid $2 registration audit retained ${registrationId}; dedicated invoice lifecycle, not ordinary journal reversal.`);
    }
    for (const id of catalogIds) {
      const result = await request("DELETE", `/barcodes/${id}`);
      verify(`Cleanup generated catalog barcode ${id}`, result.status === 404 || (result.status >= 200 && result.status < 300), result);
    }
    for (const id of customerIds) {
      const row = await request("GET", `/customers/${id}`);
      if (row.json?.data?.version) verify(`Cleanup invoice customer ${id}`, (await request("DELETE", `/customers/${id}`, undefined, {"If-Match": `"${row.json.data.version}"`})).status === 200);
    }
  }
}
