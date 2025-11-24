export enum DocumentType {
  LETTER = 'LETTER',
  MINUTES = 'MINUTES'
}

export interface GenerationState {
  isLoading: boolean;
  error: string | null;
  results: string[]; // Changed from single result to array
  selectedIndex: number; // Track which variation is selected
  type: DocumentType | null;
}

export interface HistoryItem {
  id: string;
  originalText: string;
  generatedText: string;
  type: DocumentType;
  timestamp: number;
}

export interface SavedData {
  recipients: string[];
  subjects: string[];
}

export interface DocumentInputs {
  recipientName: string;
  recipientRole: string;
  subject: string;
  body: string;
}
