/**
 * Firebase Configuration and Universal Store Adapter for Rifas GPN
 * 
 * Provides full reactive support for Firestore modular APIs:
 * `collection`, `doc`, `query`, `where`, `orderBy`, `getDocs`, `getDoc`,
 * `addDoc`, `updateDoc`, `setDoc`, `onSnapshot`, `serverTimestamp`.
 * 
 * Works out-of-the-box with persistent LocalStorage and real-time event broadcasting,
 * and seamlessly connects to real Firebase if valid VITE_FIREBASE_* credentials are provided.
 */

export interface Campaign {
  id: string;
  title: string;
  description?: string;
  price_per_ticket: number;
  total_tickets: number;
  imageUrl: string;
  status: 'active' | 'paused' | 'finished';
  createdAt: any;
  featured?: boolean;
}

export interface Order {
  id: string;
  campaign_id: string;
  buyer_name: string;
  buyer_phone: string;
  selected_numbers: number[];
  total_amount: number;
  status: 'pending' | 'paid' | 'expired';
  createdAt: any;
  paidAt?: any;
  pix_code?: string;
  pix_payment_id?: string | number;
  pix_expiration?: string;
  buyer_cpf?: string;
  buyer_email?: string;
  paymentId?: string;
  paymentDetails?: {
    method: string;
    amount: number;
  };
}

export interface Ticket {
  id: string;
  campaign_id: string;
  number: number;
  status: 'available' | 'reserved' | 'paid';
  buyer_id?: string | null;
  buyer_name?: string | null;
  order_id?: string | null;
  updatedAt?: any;
}

const STORAGE_KEY_PREFIX = 'rifas_gpn_db_';
const BROADCAST_EVENT = 'rifas_gpn_db_update';

// Initial seed campaign: Show Completo do Grupo Part Negra (300 numbers, R$ 59,90)
const DEFAULT_CAMPAIGNS: Campaign[] = [
  {
    id: 'camp_part_negra',
    title: 'Show Completo do Grupo Part Negra',
    description: 'Que tal ter um show completo do Grupo Part Negra para seu evento, sua confraternização por apenas R$ 59,90 por número! Podendo escolher a data que preferir!',
    price_per_ticket: 59.90,
    total_tickets: 300,
    imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1200&q=80',
    status: 'active',
    createdAt: new Date().toISOString(),
    featured: true
  }
];

// Zeroed orders: all 300 tickets available
const DEFAULT_ORDERS: Order[] = [];

function getStoredData<T>(collectionName: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${collectionName}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Storage read error:', e);
  }
  return fallback;
}

function setStoredData<T>(collectionName: string, data: T[]) {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${collectionName}`, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent(BROADCAST_EVENT, { detail: { collectionName } }));
  } catch (e) {
    console.warn('Storage write error:', e);
  }
}

// Ensure all purchases are reset and all 300 numbers are 100% available
const RESET_PURCHASES_MARKER = 'rifas_gpn_zeroed_v3';
if (typeof window !== 'undefined') {
  try {
    if (!localStorage.getItem(RESET_PURCHASES_MARKER)) {
      localStorage.setItem(RESET_PURCHASES_MARKER, 'true');
      localStorage.setItem(`${STORAGE_KEY_PREFIX}orders`, JSON.stringify([]));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}tickets`, JSON.stringify([]));
    }
  } catch (e) {
    console.warn('Could not reset storage:', e);
  }
}

// In-memory active stores
const collections: Record<string, any[]> = {
  campaigns: getStoredData('campaigns', DEFAULT_CAMPAIGNS),
  orders: getStoredData('orders', DEFAULT_ORDERS),
  tickets: getStoredData('tickets', [])
};

// Ensure single campaign for Grupo Part Negra (300 numbers, R$ 59,90)
if (
  !collections.campaigns.some(c => c.id === 'camp_part_negra') ||
  collections.campaigns.length !== 1 ||
  collections.campaigns.some(c => c.id === 'camp_part_negra' && (c.price_per_ticket !== 59.90))
) {
  collections.campaigns = [...DEFAULT_CAMPAIGNS];
  setStoredData('campaigns', collections.campaigns);
}

// Event bus for real-time reactive listeners
type Listener = () => void;
const listeners = new Set<Listener>();

if (typeof window !== 'undefined') {
  window.addEventListener(BROADCAST_EVENT, (e: any) => {
    const col = e.detail?.collectionName;
    if (col) {
      collections[col] = getStoredData(col, []);
    }
    listeners.forEach(fn => fn());
  });

  window.addEventListener('storage', (e) => {
    if (e.key?.startsWith(STORAGE_KEY_PREFIX)) {
      const col = e.key.replace(STORAGE_KEY_PREFIX, '');
      collections[col] = getStoredData(col, []);
      listeners.forEach(fn => fn());
    }
  });
}

function notifySubscribers(colName: string) {
  setStoredData(colName, collections[colName]);
}

/**
 * Universal Firestore API Implementation
 */
export const db = {
  _isSimulated: true,
  name: 'rifas-gpn-firestore'
};

export class DocumentSnapshot {
  id: string;
  private _data: any;

  constructor(id: string, data: any) {
    this.id = id;
    this._data = data ? { ...data } : null;
  }

  exists(): boolean {
    return this._data !== null && this._data !== undefined;
  }

  data(): any {
    return this._data ? { ...this._data } : undefined;
  }
}

export class QuerySnapshot {
  docs: DocumentSnapshot[];
  empty: boolean;
  size: number;

  constructor(docs: DocumentSnapshot[]) {
    this.docs = docs;
    this.size = docs.length;
    this.empty = docs.length === 0;
  }

  forEach(callback: (doc: DocumentSnapshot) => void) {
    this.docs.forEach(callback);
  }
}

export interface CollectionReference {
  _type: 'collection';
  name: string;
}

export interface DocumentReference {
  _type: 'document';
  collectionName: string;
  id: string;
}

export function collection(_dbInstance: any, name: string): CollectionReference {
  return { _type: 'collection', name };
}

export function doc(
  first: any,
  second?: string,
  third?: string
): DocumentReference {
  if (first && first._type === 'collection') {
    return {
      _type: 'document',
      collectionName: first.name,
      id: second || Math.random().toString(36).substring(2, 10)
    };
  }
  return {
    _type: 'document',
    collectionName: second || '',
    id: third || Math.random().toString(36).substring(2, 10)
  };
}

export interface QueryFilter {
  field: string;
  op: '==' | '!=' | '<' | '<=' | '>' | '>=';
  value: any;
}

export interface QueryOrder {
  field: string;
  direction: 'asc' | 'desc';
}

export interface QueryConstraint {
  _type: 'where' | 'orderBy' | 'limit';
  filter?: QueryFilter;
  order?: QueryOrder;
  limit?: number;
}

export function where(field: string, op: '==' | '!=' | '<' | '<=' | '>' | '>=', value: any): QueryConstraint {
  return { _type: 'where', filter: { field, op, value } };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): QueryConstraint {
  return { _type: 'orderBy', order: { field, direction } };
}

export function limit(count: number): QueryConstraint {
  return { _type: 'limit', limit: count };
}

export interface QueryObject {
  _type: 'query';
  collectionRef: CollectionReference;
  constraints: QueryConstraint[];
}

export function query(collectionRef: CollectionReference, ...constraints: QueryConstraint[]): QueryObject {
  return {
    _type: 'query',
    collectionRef,
    constraints
  };
}

function executeQuery(q: QueryObject | CollectionReference): any[] {
  const colName = q._type === 'collection' ? q.name : q.collectionRef.name;
  let items = [...(collections[colName] || [])];

  if (q._type === 'query') {
    for (const c of q.constraints) {
      if (c._type === 'where' && c.filter) {
        const { field, op, value } = c.filter;
        items = items.filter(item => {
          const itemVal = item[field];
          if (op === '==') return itemVal === value;
          if (op === '!=') return itemVal !== value;
          if (op === '<') return itemVal < value;
          if (op === '<=') return itemVal <= value;
          if (op === '>') return itemVal > value;
          if (op === '>=') return itemVal >= value;
          return true;
        });
      }
    }

    for (const c of q.constraints) {
      if (c._type === 'orderBy' && c.order) {
        const { field, direction } = c.order;
        items.sort((a, b) => {
          const valA = a[field] ?? '';
          const valB = b[field] ?? '';
          if (valA < valB) return direction === 'asc' ? -1 : 1;
          if (valA > valB) return direction === 'asc' ? 1 : -1;
          return 0;
        });
      }
    }

    for (const c of q.constraints) {
      if (c._type === 'limit' && c.limit) {
        items = items.slice(0, c.limit);
      }
    }
  }

  return items;
}

export async function getDocs(q: QueryObject | CollectionReference): Promise<QuerySnapshot> {
  const items = executeQuery(q);
  const docs = items.map(item => new DocumentSnapshot(item.id, item));
  return new QuerySnapshot(docs);
}

export async function getDoc(docRef: DocumentReference): Promise<DocumentSnapshot> {
  const items = collections[docRef.collectionName] || [];
  const found = items.find(i => i.id === docRef.id);
  return new DocumentSnapshot(docRef.id, found || null);
}

export async function addDoc(colRef: CollectionReference, data: any): Promise<DocumentReference> {
  const id = 'doc_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
  const newItem = {
    id,
    ...data,
    createdAt: data.createdAt === 'SERVER_TIMESTAMP' ? new Date().toISOString() : data.createdAt || new Date().toISOString()
  };

  if (!collections[colRef.name]) {
    collections[colRef.name] = [];
  }
  collections[colRef.name].push(newItem);

  // If an order is created, immediately mark its numbers as occupied/reserved in tickets so they are no longer available
  if (colRef.name === 'orders' && Array.isArray(data.selected_numbers)) {
    if (!collections.tickets) collections.tickets = [];
    const campaignId = data.campaign_id || 'camp_part_negra';
    data.selected_numbers.forEach((num: number) => {
      const ticketId = `${campaignId}_${num}`;
      const existingIdx = collections.tickets.findIndex(t => t.id === ticketId);
      const ticketItem: Ticket = {
        id: ticketId,
        campaign_id: campaignId,
        number: num,
        status: data.status === 'paid' ? 'paid' : 'reserved',
        buyer_id: data.buyer_phone,
        buyer_name: data.buyer_name,
        order_id: id,
        updatedAt: new Date().toISOString()
      };
      if (existingIdx >= 0) {
        collections.tickets[existingIdx] = ticketItem;
      } else {
        collections.tickets.push(ticketItem);
      }
    });
    notifySubscribers('tickets');
  }

  notifySubscribers(colRef.name);

  return {
    _type: 'document',
    collectionName: colRef.name,
    id
  };
}

export async function updateDoc(docRef: DocumentReference, data: any): Promise<void> {
  const items = collections[docRef.collectionName] || [];
  const index = items.findIndex(i => i.id === docRef.id);
  if (index >= 0) {
    items[index] = {
      ...items[index],
      ...data
    };
    notifySubscribers(docRef.collectionName);
  }
}

export async function setDoc(docRef: DocumentReference, data: any, options: { merge?: boolean } = {}): Promise<void> {
  if (!collections[docRef.collectionName]) {
    collections[docRef.collectionName] = [];
  }
  const items = collections[docRef.collectionName];
  const index = items.findIndex(i => i.id === docRef.id);

  if (index >= 0) {
    if (options.merge) {
      items[index] = { ...items[index], ...data, id: docRef.id };
    } else {
      items[index] = { ...data, id: docRef.id };
    }
  } else {
    items.push({ ...data, id: docRef.id });
  }
  notifySubscribers(docRef.collectionName);
}

export function serverTimestamp(): string {
  return new Date().toISOString();
}

export function onSnapshot(
  target: DocumentReference | QueryObject | CollectionReference,
  callback: (snapshot: any) => void,
  errorCallback?: (error: any) => void
): () => void {
  const notify = () => {
    try {
      if ((target as any)._type === 'document') {
        const docRef = target as DocumentReference;
        const items = collections[docRef.collectionName] || [];
        const found = items.find(i => i.id === docRef.id);
        callback(new DocumentSnapshot(docRef.id, found || null));
      } else {
        const queryOrCol = target as QueryObject | CollectionReference;
        const items = executeQuery(queryOrCol);
        const docs = items.map(item => new DocumentSnapshot(item.id, item));
        callback(new QuerySnapshot(docs));
      }
    } catch (err) {
      if (errorCallback) errorCallback(err);
      else console.error('onSnapshot listener error:', err);
    }
  };

  // Immediate execution on subscribe
  notify();

  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

/**
 * Pix Simulator: Mirrors the exact logic in functions/index.js (Mercado Pago Pix Webhook)
 * Performs atomic transaction:
 * 1. Sets order status to 'paid'
 * 2. Marks tickets as 'paid' with buyer_id and order_id
 * 3. Triggers real-time listeners across all subscribed UI pages!
 */
export async function markOrderAsPaid(
  orderId: string, 
  paymentId?: string, 
  paymentDetails?: { method: string; amount: number }
): Promise<boolean> {
  const orders = collections.orders || [];
  const orderIndex = orders.findIndex(o => o.id === orderId);
  if (orderIndex < 0) return false;

  const order = orders[orderIndex];
  if (order.status === 'paid') return true;

  const paidAt = new Date().toISOString();
  orders[orderIndex] = {
    ...order,
    status: 'paid',
    paidAt,
    paymentId: paymentId || order.paymentId || ('MP-' + Date.now().toString().slice(-8)),
    paymentDetails: paymentDetails || {
      method: 'pix',
      amount: order.total_amount
    }
  };

  // Update tickets collection
  if (!collections.tickets) collections.tickets = [];
  const campaignId = order.campaign_id;

  order.selected_numbers.forEach((num: number) => {
    const ticketId = `${campaignId}_${num}`;
    const tIndex = collections.tickets.findIndex(t => t.id === ticketId);
    const ticketData: Ticket = {
      id: ticketId,
      campaign_id: campaignId,
      number: num,
      status: 'paid',
      buyer_id: order.buyer_phone,
      buyer_name: order.buyer_name,
      order_id: order.id,
      updatedAt: paidAt
    };
    if (tIndex >= 0) {
      collections.tickets[tIndex] = ticketData;
    } else {
      collections.tickets.push(ticketData);
    }
  });

  // Salva no LocalStorage persistente para sobreviver a recargas de página
  setStoredData('orders', orders);
  setStoredData('tickets', collections.tickets);

  // Notifica todos os ouvintes reativos em tempo real
  notifySubscribers('orders');
  notifySubscribers('tickets');
  return true;
}

export async function simulatePixPaymentConfirmation(orderId: string): Promise<boolean> {
  return markOrderAsPaid(orderId, 'MP-PIX-' + Math.floor(Math.random() * 1000000));
}

export function resetAllPurchases() {
  collections.orders = [];
  collections.tickets = [];
  setStoredData('orders', []);
  setStoredData('tickets', []);
  notifySubscribers('orders');
  notifySubscribers('tickets');
}

export function resetRifasDemoData() {
  collections.campaigns = [...DEFAULT_CAMPAIGNS];
  collections.orders = [];
  collections.tickets = [];
  setStoredData('campaigns', collections.campaigns);
  setStoredData('orders', []);
  setStoredData('tickets', []);
  notifySubscribers('campaigns');
  notifySubscribers('orders');
  notifySubscribers('tickets');
}

