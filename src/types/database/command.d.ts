export interface CommandsTable {
  id?: string;
  created_at?: Date   
  broadcaster_id: number;  
  command: string;  
  message: string;  
  action: string | null;
  status: boolean;  
  updated_by: string | null;  
  updated_at: Date;  
  userlevel: string;  
  user_id: string;  
  cooldown: number;  
}