
import {
  Injectable,
  computed,
  effect,
  linkedSignal,
  resource
} from '@angular/core';

import {
  Issue,
  IssueStatus,
  StoryPoints,
  TeamMember
} from '../models/issue.model';

const STORAGE_KEY = 'issue-tracker-data';

const ALLOWED_MOVES: Record<IssueStatus, IssueStatus[]> = {
  'To Do': ['In Progress'],
  'In Progress': ['In Review', 'To Do'],
  'In Review': ['Done', 'In Progress'],
  'Done': ['To Do']
};
const VALID_STORY_POINTS: StoryPoints[] = [1, 2, 3, 5, 8];

export type IssueChanges = Partial<
  Pick<
    Issue,
    'title' | 'priority' | 'assigneeId' | 'storyPoints' | 'dueDate'
  >
>;

export type NewIssue = Omit<Issue, 'id' | 'status'>;

export interface StoreResult {
  success: boolean;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class IssueStore {

  // Load seed data from the public folder.
  private readonly seedResource = resource({
    loader: async ({ abortSignal }) => {

      const [issuesResponse, teamResponse] = await Promise.all([
        fetch('/issues.json', { signal: abortSignal }),
        fetch('/team.json', { signal: abortSignal })
      ]);

      if (!issuesResponse.ok || !teamResponse.ok) {
        throw new Error('Unable to load issue or team data.');
      }

      const seedIssues: Issue[] = await issuesResponse.json();
      const team: TeamMember[] = await teamResponse.json();

      // Restore previously saved issues if available.
      let issues = seedIssues;

      if (typeof localStorage !== 'undefined') {
        const savedData = localStorage.getItem(STORAGE_KEY);

        if (savedData) {
          try {
            const parsed = JSON.parse(savedData);

            if (Array.isArray(parsed) && parsed.every(
              (item: Issue) =>
                typeof item.id === 'string' &&
                typeof item.title === 'string'
            )) {
              issues = parsed;
            }
          } catch {
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      }

      return { issues, team };
    }
  });

  // Private writable signal.
  private readonly _issues = linkedSignal(
    () => this.seedResource.value()?.issues ?? []
  );

  // Public read-only signals.
  readonly issues = this._issues.asReadonly();

  readonly team = computed(
    () => this.seedResource.value()?.team ?? []
  );

  readonly loading = this.seedResource.isLoading;

  readonly error = this.seedResource.error;

  // Summary calculations always use ALL issues.
  readonly openCount = computed(
    () => this.issues().filter(issue => issue.status !== 'Done').length
  );

  readonly overdueCount = computed(
    () => this.issues().filter(issue => this.isOverdue(issue)).length
  );

  readonly completionPercentage = computed(() => {
    const allIssues = this.issues();

    const totalPoints = allIssues.reduce(
      (sum, issue) => sum + issue.storyPoints,
      0
    );

    const completedPoints = allIssues
      .filter(issue => issue.status === 'Done')
      .reduce((sum, issue) => sum + issue.storyPoints, 0);

    return totalPoints === 0
      ? 0
      : Math.round((completedPoints / totalPoints) * 100);
  });

  constructor() {

    // Persistence is the only side effect.
    effect(() => {
      if (!this.seedResource.hasValue()) {
        return;
      }

      const currentIssues = this._issues();

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(currentIssues)
        );
      }
    });
  }

  // Check whether an issue is overdue.
  isOverdue(issue: Issue): boolean {
    if (!issue.dueDate || issue.status === 'Done') {
      return false;
    }

    const today = this.getToday();

    return issue.dueDate < today;
  }

  // Return the permitted workflow transitions.
  getAllowedMoves(status: IssueStatus): IssueStatus[] {
    return [...ALLOWED_MOVES[status]];
  }

  // Find an issue by ID.
  getIssue(id: string): Issue | undefined {
    return this.issues().find(issue => issue.id === id);
  }

  // Count active issues assigned to a team member.
  getInProgressCount(assigneeId: string): number {
    return this.issues().filter(
      issue =>
        issue.assigneeId === assigneeId &&
        issue.status === 'In Progress'
    ).length;
  }

  // Move an issue between workflow columns.
  moveIssue(
    id: string,
    newStatus: IssueStatus
  ): StoreResult {

    const issue = this.getIssue(id);

    if (!issue) {
      return {
        success: false,
        message: 'Issue not found.'
      };
    }

    if (!ALLOWED_MOVES[issue.status].includes(newStatus)) {
      return {
        success: false,
        message: `Moving from ${issue.status} to ${newStatus} is not allowed.`
      };
    }

    // BR-2: An issue cannot enter In Progress without an assignee.
    if (newStatus === 'In Progress') {

      if (!issue.assigneeId) {
        return {
          success: false,
          message: 'Assign this issue to a team member before moving it to In Progress.'
        };
      }

      // BR-5: Reopened issues need a new due date.
      if (!issue.dueDate) {
        return {
          success: false,
          message: 'Set a due date before moving this issue to In Progress.'
        };
      }

      // BR-3: Maximum 3 In Progress issues per person.
      const currentCount = this.getInProgressCount(issue.assigneeId);

      if (currentCount >= 3) {
        return {
          success: false,
          message: 'WIP limit reached. This team member already has 3 issues In Progress.'
        };
      }
    }

   
  // BR-5: Clear due date when reopening a completed issue.
  this._issues.update(issues =>
    issues.map(item =>
      item.id === id
        ? {
            ...item,
            status: newStatus,
            dueDate:
              item.status === 'Done' && newStatus === 'To Do'
                ? null
                : item.dueDate
          }
        : item
    )
  );

  return {
    success: true,
    message: `Issue ${id} moved to ${newStatus}.`
  };
}

// Edit permitted issue fields.
updateIssue(
  id: string,
  changes: IssueChanges
): StoreResult {

  const issue = this.getIssue(id);

  if (!issue) {
    return {
      success: false,
      message: 'Issue not found.'
    };
  }

  // Validate issue title.
  if (
    changes.title !== undefined &&
    changes.title.trim().length === 0
  ) {
    return {
      success: false,
      message: 'Issue title cannot be empty.'
    };
  }

  // Validate due date when it is changed.
  if (
    changes.dueDate !== undefined &&
    changes.dueDate !== issue.dueDate &&
    changes.dueDate &&
    changes.dueDate < this.getToday()
  ) {
    return {
      success: false,
      message: 'Due date cannot be in the past.'
    };
  }

  // BR-4: Validate story points.
  if (
    changes.storyPoints !== undefined &&
    !VALID_STORY_POINTS.includes(changes.storyPoints)
  ) {
    return {
      success: false,
      message: 'Story points must be 1, 2, 3, 5 or 8.'
    };
  }

  const nextAssignee =
    changes.assigneeId !== undefined
      ? changes.assigneeId
      : issue.assigneeId;

  // BR-2: In Progress issues cannot be unassigned.
  if (issue.status === 'In Progress' && !nextAssignee) {
    return {
      success: false,
      message: 'An In Progress issue must have an assignee.'
    };
  }

  // BR-3: Check WIP limit when reassignment happens.
  if (
    issue.status === 'In Progress' &&
    nextAssignee &&
    nextAssignee !== issue.assigneeId
  ) {
    const newAssigneeCount =
      this.getInProgressCount(nextAssignee);

    if (newAssigneeCount >= 3) {
      return {
        success: false,
        message: 'Cannot reassign. The selected team member already has 3 issues In Progress.'
      };
    }
  }

  // Update issue immutably.
  this._issues.update(issues =>
    issues.map(item =>
      item.id === id
        ? {
            ...item,
            ...changes,
            title: changes.title?.trim() ?? item.title
          }
        : item
    )
  );

  return {
    success: true,
    message: 'Issue updated successfully.'
  };
}

// Create a new issue.
createIssue(input: NewIssue): StoreResult {

  if (!input.title || input.title.trim().length < 5) {
    return {
      success: false,
      message: 'Title must contain at least 5 characters.'
    };
  }

  // Validate due date.
  if (input.dueDate && input.dueDate < this.getToday()) {
    return {
      success: false,
      message: 'Due date cannot be in the past.'
    };
  }

  // Validate story points.
  if (!VALID_STORY_POINTS.includes(input.storyPoints)) {
    return {
      success: false,
      message: 'Invalid story points.'
    };
  }

  // Validate assignee.
  if (
    input.assigneeId &&
    !this.team().some(member => member.id === input.assigneeId)
  ) {
    return {
      success: false,
      message: 'Please select a valid team member.'
    };
  }

  // Generate the next issue ID.
  const highestId = this.issues().reduce((max, issue) => {
    const number = Number(issue.id.replace('TRK-', ''));
    return Math.max(max, number);
  }, 100);

  const newIssue: Issue = {
    ...input,
    id: `TRK-${highestId + 1}`,
    title: input.title.trim(),
    status: 'To Do'
  };

  this._issues.update(issues => [
    ...issues,
    newIssue
  ]);

  return {
    success: true,
    message: `Issue ${newIssue.id} created successfully.`
  };
}

// Restore the original seed data.
retryLoading(): void {
  this.seedResource.reload();
}

resetData(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }

  this.seedResource.reload();
}

// Local date in YYYY-MM-DD format.
private getToday(): string {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
}