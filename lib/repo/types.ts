// Row types returned by the repository layer (camelCased from SQL rows).

export type School = {
  id: number;
  name: string;
  shortName: string;
  address: string;
  phone: string;
  email: string;
  motto: string;
  logoUrl: string | null;
};

export type SessionRow = {
  id: number;
  name: string;
  startDate: string | null;
  endDate: string | null;
  isCurrent: number;
  status: string;
};

export type TermRow = {
  id: number;
  name: string;
  sessionId: number;
  startDate: string | null;
  endDate: string | null;
  isCurrent: number;
  status: string;
};

export type ClassGroupRow = {
  id: number;
  name: string;
  description: string | null;
  status: string;
};

export type ClassRow = {
  id: number;
  name: string;
  code: string;
  section: string | null;
  classGroupId: number | null;
  sessionId: number | null;
  classTeacherId: number | null;
  capacity: number;
  status: string;
};

export type ClassListRow = ClassRow & {
  groupName: string | null;
  teacherName: string | null;
  studentCount: number;
  feeTotal: number;
};

export type ParentRow = {
  id: number;
  name: string;
  relationship: string;
  phone: string;
  email: string | null;
  address: string | null;
  occupation: string | null;
};

export type StudentRow = {
  id: number;
  studentCode: string;
  admissionNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  gender: string;
  dateOfBirth: string | null;
  photoUrl: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  parentId: number | null;
  admissionDate: string;
  status: string;
};

export type StudentListRow = StudentRow & {
  parentName: string | null;
  parentPhone: string | null;
  parentRelationship: string | null;
  className: string | null;
  classId: number | null;
};

export type TeacherRow = {
  id: number;
  teacherCode: string;
  firstName: string;
  lastName: string;
  gender: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  qualification: string | null;
  specialization: string | null;
  dateEmployed: string | null;
  photoUrl: string | null;
  status: string;
};

export type TeacherListRow = TeacherRow & { classCount: number; hasAccount: boolean };

export type UserRow = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  username: string;
  role: string;
  status: string;
  teacherId: number | null;
  parentId: number | null;
  lastLoginAt: string | null;
};

export type UserWithLinks = UserRow & {
  passwordHash: string;
  teacher: { id: number; firstName: string; lastName: string } | null;
  parent: { id: number; name: string; phone: string } | null;
};

export type FeeCategoryRow = { id: number; name: string; description: string | null; feeCount: number };

export type FeeRow = {
  id: number;
  name: string;
  categoryId: number;
  categoryName: string;
  amount: number;
  classId: number;
  className: string;
  sessionId: number;
  sessionName: string;
  termId: number;
  termName: string;
  dueDate: string | null;
  description: string | null;
  mandatory: number;
  status: string;
};

export type OtherPaymentRow = {
  id: number;
  name: string;
  category: string;
  amount: number;
  scope: string;
  studentId: number | null;
  studentName: string | null;
  classId: number | null;
  className: string | null;
  classGroupId: number | null;
  groupName: string | null;
  sessionId: number;
  sessionName: string;
  termId: number;
  termName: string;
  dueDate: string | null;
  description: string | null;
  mandatory: number;
  status: string;
};

export type InvoiceItemRow = {
  id: number;
  invoiceId: number;
  description: string;
  amount: number;
  quantity: number;
  feeId: number | null;
  otherPaymentId: number | null;
};

export type InvoiceRow = {
  id: number;
  invoiceNumber: string;
  studentId: number;
  sessionId: number;
  termId: number;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  dueDate: string | null;
  status: string;
  notes: string | null;
  generatedByUserId: number | null;
  generatedByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InvoiceListRow = InvoiceRow & {
  firstName: string;
  middleName: string | null;
  lastName: string;
  studentCode: string;
  admissionNumber: string;
  parentPhone: string | null;
  className: string | null;
  classId: number | null;
  sessionName: string;
  termName: string;
};

export type InvoiceDetailRow = InvoiceListRow & {
  items: InvoiceItemRow[];
  payments: PaymentListRow[];
  studentPhone: string | null;
  studentEmail: string | null;
  studentAddress: string | null;
  dateOfBirth: string | null;
  gender: string;
  parentName: string | null;
  parentRelationship: string | null;
};

export type PaymentRow = {
  id: number;
  reference: string;
  receiptNumber: string | null;
  invoiceId: number | null;
  studentId: number;
  amount: number;
  method: string;
  channel: string | null;
  transactionReference: string | null;
  paymentDate: string;
  recordedByUserId: number | null;
  recordedByName: string | null;
  notes: string | null;
  status: string;
};

export type PaymentListRow = PaymentRow & {
  firstName: string;
  lastName: string;
  studentCode: string;
  invoiceNumber: string | null;
  sessionId: number | null;
  sessionName: string | null;
  termName: string | null;
  className: string | null;
};

export type DebtorRow = {
  studentId: number;
  firstName: string;
  middleName: string | null;
  lastName: string;
  studentCode: string;
  admissionNumber: string;
  parentName: string | null;
  parentPhone: string | null;
  classId: number | null;
  className: string | null;
  classGroupId: number | null;
  groupName: string | null;
  totalBill: number;
  totalPaid: number;
  outstanding: number;
  dueDate: string | null;
  invoiceCount: number;
};

export type AssignmentRow = {
  id: number;
  studentId: number;
  classId: number;
  sessionId: number;
  termId: number;
  assignedAt: string;
  assignedByName: string | null;
  firstName: string;
  lastName: string;
  studentCode: string;
  className: string;
  classCode: string;
};

export type TeacherAssignmentRow = {
  id: number;
  teacherId: number;
  teacherCode: string;
  firstName: string;
  lastName: string;
  classId: number;
  className: string;
  classCode: string;
  sessionId: number;
  sessionName: string;
  termId: number;
  termName: string;
  role: string;
  subject: string | null;
  assignedAt: string;
};

export type NotificationRow = {
  id: number;
  userId: number;
  title: string;
  message: string;
  type: string;
  link: string | null;
  readStatus: number;
  createdAt: string;
};

export type AuditLogRow = {
  id: number;
  userId: number | null;
  userName: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  oldValue: string | null;
  newValue: string | null;
  ip: string | null;
  createdAt: string;
};
