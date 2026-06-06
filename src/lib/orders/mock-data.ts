import type { Order } from "./types";

export const MOCK_ORDERS: Order[] = [
  {
    orderId: "ord-001",
    sender: {
      id: "party-s-001",
      clientId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      name: "North Harbor Supply Co.",
      documentId: "NH-88421",
      email: "dispatch@northharbor.example",
      phones: [
        { id: "oph-001", number: "+1 (718) 555-0142", label: "Dispatch" },
        { id: "oph-002", number: "+1 (718) 555-0198", label: "After hours" },
      ],
      addresses: [
        {
          id: "opa-001",
          streetAddress: "245 Atlantic Ave",
          apt: "Suite 400",
          city: "Brooklyn",
          state: "NY",
          provinceCountry: "USA",
          zipCode: "11201",
          isPrimary: false,
        },
        {
          id: "opa-002",
          streetAddress: "18 Industrial Park Dr",
          city: "Newark",
          state: "NJ",
          provinceCountry: "USA",
          zipCode: "07105",
          isPrimary: false,
        },
      ],
      orderAddressId: "opa-001",
    },
    receivers: [
      {
        id: "party-r-001",
        clientId: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
        name: "María Rodríguez",
        documentId: "001-1234567-8",
        email: "maria.rodriguez@example.com",
        phones: [{ id: "oph-003", number: "+1 (809) 555-3321", label: "Mobile" }],
        addresses: [
          {
            id: "opa-003",
            streetAddress: "Calle El Conde 118",
            crossStreet: "Esquina Merced",
            city: "Santo Domingo",
            provinceCountry: "Distrito Nacional, RD",
            zipCode: "10210",
            isPrimary: false,
          },
        ],
        orderAddressId: "opa-003",
      },
    ],
    date: "2026-06-04",
    containerId: "cnt-001",
    pending: "usa",
    branch: "usa",
    routeId: "rte-001",
    routeAssignmentId: "ras-001",
    comments: [
      { id: "oc-001", purpose: "take_box", quantity: 3 },
      { id: "oc-002", purpose: "make_estimate", note: "Include fragile handling" },
      { id: "oc-003", purpose: "collect_payment", note: "Cash on delivery" },
    ],
    completed: false,
    createdAt: "2026-06-03T18:00:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-04T14:22:00Z",
  },
  {
    orderId: "ord-002",
    sender: {
      id: "party-s-002",
      clientId: "c3d4e5f6-a7b8-9012-cdef-123456789012",
      name: "Blue Coast Foods",
      documentId: "BCF-2201",
      phones: [{ id: "oph-004", number: "+1 (305) 555-7788", label: "Shipping desk" }],
      addresses: [
        {
          id: "opa-004",
          streetAddress: "8800 NW 36th St",
          city: "Doral",
          state: "FL",
          provinceCountry: "USA",
          zipCode: "33166",
          isPrimary: false,
        },
      ],
      orderAddressId: "opa-004",
    },
    receivers: [],
    date: "2026-06-03",
    containerId: "cnt-001",
    pending: "usa",
    branch: "usa",
    routeId: "rte-004",
    routeAssignmentId: "ras-002",
    comments: [
      { id: "oc-004", purpose: "pickup_barrel", quantity: 2 },
      { id: "oc-005", purpose: "general_comment", text: "Customer will confirm pickup window by phone." },
    ],
    completed: true,
    createdAt: "2026-06-02T16:30:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-03T11:05:00Z",
  },
  {
    orderId: "ord-003",
    sender: {
      id: "party-s-003",
      clientId: "e5f6a7b8-c9d0-1234-ef01-345678901234",
      name: "Metro Logistics LLC",
      phones: [{ id: "oph-005", number: "+1 (212) 555-2200" }],
      addresses: [
        {
          id: "opa-005",
          streetAddress: "350 Fifth Ave",
          apt: "Floor 21",
          city: "New York",
          state: "NY",
          provinceCountry: "USA",
          zipCode: "10118",
          isPrimary: false,
        },
      ],
      orderAddressId: "opa-005",
    },
    receivers: [
      {
        id: "party-r-002",
        clientId: "d4e5f6a7-b8c9-0123-def0-234567890123",
        name: "Carlos Méndez",
        phones: [
          { id: "oph-006", number: "+1 (809) 555-4410", label: "Mobile" },
          { id: "oph-007", number: "+1 (809) 555-4411", label: "Office" },
        ],
        addresses: [
          {
            id: "opa-006",
            streetAddress: "Av. Winston Churchill 1099",
            apt: "Apt 12B",
            city: "Santo Domingo",
            provinceCountry: "Distrito Nacional, RD",
            isPrimary: false,
          },
          {
            id: "opa-007",
            streetAddress: "Calle Principal 22",
            city: "Boca Chica",
            provinceCountry: "Santo Domingo, RD",
            isPrimary: false,
          },
        ],
        orderAddressId: "opa-007",
      },
      {
        id: "party-r-003",
        clientId: "f6a7b8c9-d0e1-2345-f012-456789012345",
        name: "Ana Lucía Pérez",
        phones: [{ id: "oph-008", number: "+1 (849) 555-9022" }],
        addresses: [
          {
            id: "opa-008",
            streetAddress: "Calle Duarte 45",
            city: "Santiago",
            provinceCountry: "Santiago, RD",
            zipCode: "51000",
            isPrimary: false,
          },
        ],
        orderAddressId: "opa-008",
      },
    ],
    date: "2026-06-02",
    containerId: "cnt-002",
    pending: "dr",
    branch: "dr",
    routeId: "rte-003",
    routeAssignmentId: "ras-003",
    comments: [
      { id: "oc-006", purpose: "take_tape", quantity: 5 },
      { id: "oc-007", purpose: "take_other", quantity: 1, description: "Custom crate" },
      { id: "oc-008", purpose: "pickup_other", quantity: 2, description: "Empty pallets" },
    ],
    completed: false,
    createdAt: "2026-06-01T10:15:00Z",
    createdBy: "Admin User",
    updatedAt: "2026-06-02T18:40:00Z",
  },
  {
    orderId: "ord-004",
    sender: {
      id: "party-s-001b",
      clientId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      name: "North Harbor Supply Co.",
      documentId: "NH-88421",
      phones: [{ id: "oph-001b", number: "+1 (718) 555-0142", label: "Dispatch" }],
      addresses: [
        {
          id: "opa-001b",
          streetAddress: "245 Atlantic Ave",
          apt: "Suite 400",
          city: "Brooklyn",
          state: "NY",
          provinceCountry: "USA",
          zipCode: "11201",
          isPrimary: false,
        },
      ],
      orderAddressId: "opa-001b",
    },
    receivers: [
      {
        id: "party-r-001b",
        name: "Warehouse DR",
        phones: [{ id: "oph-003b", number: "+1 (809) 555-1000" }],
        addresses: [
          {
            id: "opa-003b",
            streetAddress: "Zona Industrial Herrera",
            city: "Santo Domingo",
            provinceCountry: "Distrito Nacional, RD",
            isPrimary: false,
          },
        ],
        orderAddressId: "opa-003b",
      },
    ],
    date: "2026-05-15",
    containerId: "cnt-001",
    pending: "dr",
    branch: "usa",
    routeId: "rte-001",
    routeAssignmentId: "ras-001",
    comments: [{ id: "oc-009", purpose: "take_box", quantity: 8 }],
    completed: true,
    createdAt: "2026-05-14T12:00:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-05-16T09:00:00Z",
  },
];

export function cloneOrders(): Order[] {
  return MOCK_ORDERS.map((order) => ({
    ...order,
    sender: {
      ...order.sender,
      phones: order.sender.phones.map((phone) => ({ ...phone })),
      addresses: order.sender.addresses.map((address) => ({ ...address })),
    },
    receivers: order.receivers.map((receiver) => ({
      ...receiver,
      phones: receiver.phones.map((phone) => ({ ...phone })),
      addresses: receiver.addresses.map((address) => ({ ...address })),
    })),
    comments: order.comments.map((comment) => ({ ...comment })),
  }));
}

export function getOrderById(orderId: string): Order | undefined {
  return MOCK_ORDERS.find((order) => order.orderId === orderId);
}
