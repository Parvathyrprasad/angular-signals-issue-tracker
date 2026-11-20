
import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed
} from '@angular/core';

import {
  Issue,
  IssueStatus,
  TeamMember
} from '../../../../core/models/issue.model';

import { IssueCardComponent } from '../issue-card/issue-card';

const PRIORITY_ORDER: Record<string, number> = {
  Critical: 1,
  High: 2,
  Medium: 3,
  Low: 4
};

@Component({
  selector: 'app-kanban-column',
  standalone: true,
  imports: [IssueCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './kanban-column.html',
  styleUrl: './kanban-column.css'
})
export class KanbanColumnComponent {

  status = input.required<IssueStatus>();

  issues = input.required<Issue[]>();

  team = input.required<TeamMember[]>();

  selected = output<Issue>();

  readonly sortedIssues = computed(() => {
    return [...this.issues()].sort((a, b) => {

      const priorityDifference =
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      // Issues without due dates appear last.
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;

      return a.dueDate.localeCompare(b.dueDate);
    });
  });

  readonly totalPoints = computed(() =>
    this.issues().reduce(
      (total, issue) => total + issue.storyPoints,
      0
    )
  );

  onIssueSelected(issue: Issue): void {
    this.selected.emit(issue);
  }
}
