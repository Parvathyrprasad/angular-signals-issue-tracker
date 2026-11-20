
export type IssueType = 'Bug' | 'Task' | 'Story';

export type Priority = 'Critical' | 'High' | 'Medium' | 'Low';

export type IssueStatus =
  | 'To Do'
  | 'In Progress'
  | 'In Review'
  | 'Done';

export type StoryPoints = 1 | 2 | 3 | 5 | 8;

export interface Issue {
  id: string;
  title: string;
  description: string;
  type: IssueType;
  priority: Priority;
  status: IssueStatus;
  assigneeId: string | null;
  storyPoints: StoryPoints;
  dueDate: string | null;
}

export interface TeamMember {
  id: string;
  name: string;
}
