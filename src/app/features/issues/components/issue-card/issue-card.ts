
import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  inject
} from '@angular/core';

import { Issue, TeamMember } from '../../../../core/models/issue.model';
import { IssueStore } from '../../../../core/services/issue-store';

@Component({
  selector: 'app-issue-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './issue-card.html',
  styleUrl: './issue-card.css'
})
export class IssueCardComponent {

  issue = input.required<Issue>();
  team = input.required<TeamMember[]>();

  selected = output<Issue>();

  private store = inject(IssueStore);

  assigneeName = computed(() => {
    const assigneeId = this.issue().assigneeId;

    if (!assigneeId) {
      return 'Unassigned';
    }

    return this.team().find(
      member => member.id === assigneeId
    )?.name ?? 'Unassigned';
  });

  overdue = computed(() => this.store.isOverdue(this.issue()));

  openDetails(): void {
    this.selected.emit(this.issue());
  }
}
