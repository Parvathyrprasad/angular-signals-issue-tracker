
import {
  Component,
  ChangeDetectionStrategy,
  computed,
  input,
  output,
  signal,
  linkedSignal,
  inject
} from '@angular/core';

import {
  Issue,
  IssueStatus,
  Priority,
  StoryPoints
} from '../../../../core/models/issue.model';

import { IssueStore } from '../../../../core/services/issue-store';

@Component({
  selector: 'app-issue-detail-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './issue-detail-panel.html',
  styleUrl: './issue-detail-panel.css'
})
export class IssueDetailPanelComponent {
  readonly issue = input.required<Issue>();
  readonly closed = output<void>();

  private readonly store = inject(IssueStore);

  readonly currentIssue = computed(
    () => this.store.getIssue(this.issue().id) ?? this.issue()
  );

  readonly draft = linkedSignal(
    () => ({ ...this.currentIssue() })
  );

  private readonly editState = signal({
    issueId: '',
    editing: false
  });

  readonly isEditing = computed(
    () =>
      this.editState().issueId === this.currentIssue().id &&
      this.editState().editing
  );

  readonly allowedMoves = computed(
    () => this.store.getAllowedMoves(this.currentIssue().status)
  );

  readonly team = this.store.team;

  readonly message = signal('');
  readonly messageType = signal<'success' | 'error' | ''>('');

  readonly storyPointOptions: StoryPoints[] = [1, 2, 3, 5, 8];

  readonly priorityOptions: Priority[] = [
    'Critical',
    'High',
    'Medium',
    'Low'
  ];

  getToday(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  startEditing(): void {
    this.draft.set({ ...this.currentIssue() });

    this.editState.set({
      issueId: this.currentIssue().id,
      editing: true
    });

    this.clearMessage();
  }

  updateTitle(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.draft.update(issue => ({ ...issue, title: value }));
  }

  updatePriority(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as Priority;

    if (!this.priorityOptions.includes(value)) {
      return;
    }

    this.draft.update(issue => ({ ...issue, priority: value }));
  }

  updateAssignee(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.draft.update(issue => ({ ...issue, assigneeId: value || null }));
  }

  updateStoryPoints(event: Event): void {
    const value = Number(
      (event.target as HTMLSelectElement).value
    ) as StoryPoints;

    if (!this.storyPointOptions.includes(value)) {
      return;
    }

    this.draft.update(issue => ({ ...issue, storyPoints: value }));
  }

  updateDueDate(event: Event): void {
    const value = (event.target as HTMLInputElement).value;

    this.draft.update(issue => ({
      ...issue,
      dueDate: value || null
    }));
  }

  saveChanges(): void {
    const changes = {
      title: this.draft().title.trim(),
      priority: this.draft().priority,
      assigneeId: this.draft().assigneeId,
      storyPoints: this.draft().storyPoints,
      dueDate: this.draft().dueDate
    };

    const result = this.store.updateIssue(
      this.currentIssue().id,
      changes
    );

    this.showResult(result.success, result.message);

    if (result.success) {
      this.editState.set({
        issueId: this.currentIssue().id,
        editing: false
      });
    }
  }

  cancelEditing(): void {
    this.draft.set({ ...this.currentIssue() });

    this.editState.set({
      issueId: this.currentIssue().id,
      editing: false
    });

    this.clearMessage();
  }

  changeStatus(status: IssueStatus): void {
    const result = this.store.moveIssue(
      this.currentIssue().id,
      status
    );

    this.showResult(result.success, result.message);
  }

  closePanel(): void {
    this.closed.emit();
  }

  private showResult(success: boolean, message: string): void {
    this.message.set(message);
    this.messageType.set(success ? 'success' : 'error');
  }

  private clearMessage(): void {
    this.message.set('');
    this.messageType.set('');
  }
}
