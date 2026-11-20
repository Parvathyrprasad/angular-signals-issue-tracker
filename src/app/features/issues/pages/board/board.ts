
import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  signal,
  OnDestroy
} from '@angular/core';

import {
  Issue,
  IssueStatus,
  Priority
} from '../../../../core/models/issue.model';

import { IssueStore } from '../../../../core/services/issue-store';

import { KanbanColumnComponent } from '../../components/kanban-column/kanban-column';

import { IssueDetailPanelComponent } from '../../components/issue-detail-panel/issue-detail-panel';

import { IssueFormComponent } from '../../components/issue-form/issue-form';

@Component({
  selector: 'app-board',
  standalone: true,
  imports: [
  KanbanColumnComponent,
  IssueDetailPanelComponent,
  IssueFormComponent
],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './board.html',
  styleUrl: './board.css'
})
export class BoardComponent implements OnDestroy {

  private readonly store = inject(IssueStore);

  // Shared signals from IssueStore
  readonly issues = this.store.issues;
  readonly team = this.store.team;

  readonly loading = this.store.loading;
  readonly error = this.store.error;

  // Summary statistics
  readonly openCount = this.store.openCount;
  readonly overdueCount = this.store.overdueCount;
  readonly completionPercentage = this.store.completionPercentage;

  // Kanban statuses
  readonly statuses: IssueStatus[] = [
    'To Do',
    'In Progress',
    'In Review',
    'Done'
  ];

  // Priority options
  readonly priorities: Priority[] = [
    'Critical',
    'High',
    'Medium',
    'Low'
  ];

  // Filter signals
  readonly searchInput = signal('');
  readonly searchTerm = signal('');
  readonly assigneeFilter = signal('all');
  readonly priorityFilter = signal('all');

  private searchTimer?: ReturnType<typeof setTimeout>;

  // Selected issue and form visibility
  readonly selectedIssue = signal<Issue | null>(null);
  readonly showCreateForm = signal(false);

  // Apply all filters
  readonly filteredIssues = computed(() => {

    const search = this.searchTerm().trim().toLowerCase();
    const assignee = this.assigneeFilter();
    const priority = this.priorityFilter();

    return this.issues().filter(issue => {

      const matchesSearch =
        !search ||
        issue.title.toLowerCase().includes(search) ||
        issue.id.toLowerCase().includes(search);

      const matchesAssignee =
        assignee === 'all' ||
        (assignee === 'unassigned' && !issue.assigneeId) ||
        issue.assigneeId === assignee;

      const matchesPriority =
        priority === 'all' ||
        issue.priority === priority;

      return matchesSearch && matchesAssignee && matchesPriority;
    });
  });

  // Group filtered issues by status
  readonly issuesByStatus = computed(() => {

    const groups: Record<IssueStatus, Issue[]> = {
      'To Do': [],
      'In Progress': [],
      'In Review': [],
      'Done': []
    };

    for (const issue of this.filteredIssues()) {
      groups[issue.status].push(issue);
    }

    return groups;
  });

  // Filter result counts
  readonly showingCount = computed(
    () => this.filteredIssues().length
  );

  readonly totalCount = computed(
    () => this.issues().length
  );

  // Search with 300ms debounce
  onSearchChange(event: Event): void {

    const value = (event.target as HTMLInputElement).value;

    this.searchInput.set(value);

    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }

    this.searchTimer = setTimeout(() => {
      this.searchTerm.set(value);
    }, 300);
  }

  // Assignee filter
  onAssigneeChange(event: Event): void {
    this.assigneeFilter.set(
      (event.target as HTMLSelectElement).value
    );
  }

  // Priority filter
  onPriorityChange(event: Event): void {
    this.priorityFilter.set(
      (event.target as HTMLSelectElement).value
    );
  }

  // Clear all filters
  clearFilters(): void {

    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
      this.searchTimer = undefined;
    }

    this.searchInput.set('');
    this.searchTerm.set('');
    this.assigneeFilter.set('all');
    this.priorityFilter.set('all');
  }

  // Open issue detail panel
  openIssue(issue: Issue): void {
    this.selectedIssue.set(issue);
  }

  // Close issue detail panel
  closeIssue(): void {
    this.selectedIssue.set(null);
  }

  // Open create issue form
  openCreateForm(): void {
    this.showCreateForm.set(true);
  }

  // Close create issue form
  closeCreateForm(): void {
    this.showCreateForm.set(false);
  }

  // Retry JSON loading
  retryLoading(): void {
    this.store.retryLoading();
  }

  // Reset all application data
  resetData(): void {

    const confirmed = window.confirm(
      'Are you sure you want to reset all changes and restore the original seed data?'
    );

    if (confirmed) {

      this.selectedIssue.set(null);
      this.showCreateForm.set(false);

      this.clearFilters();

      this.store.resetData();
    }
  }

  // Clean up search timer
  ngOnDestroy(): void {

    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
  }
}
