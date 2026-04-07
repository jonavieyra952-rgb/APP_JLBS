export interface Guard {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'on-patrol' | 'break';
  lastLocation?: { lat: number; lng: number };
  lastUpdate: string;
  avatar?: string;
}

export interface PatrolRoute {
  id: string;
  name: string;
  checkpoints: Checkpoint[];
  assignedGuardId?: string;
  schedule: string;
}

export interface Checkpoint {
  id: string;
  name: string;
  location: { lat: number; lng: number };
  status: 'pending' | 'completed' | 'missed';
  timestamp?: string;
}

export interface Incident {
  id: string;
  type: 'security' | 'maintenance' | 'medical' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  guardId: string;
  timestamp: string;
  location: { lat: number; lng: number };
  status: 'open' | 'in-progress' | 'resolved';
  images?: string[];
}
