
import {
  Component,
  ChangeDetectionStrategy,
  output,
  inject,
  signal
} from '@angular/core';

import {
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import {
  IssueType,
  Priority,
  StoryPoints
} from '../../../../core/models/issue.model';

import {
  IssueStore,
  NewIssue
} from '../../../../core/services/issue-store';

@Component({
  selector: 'app-issue-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './issue-form.html',
  styleUrl: './issue-form.css'
})
export class IssueFormComponent {

  private readonly fb = inject(FormBuilder);
  private readonly store = inject(IssueStore);

  readonly closed = output<void>();
  readonly created = output<void>();

  readonly errorMessage = signal('');

  readonly team = this.store.team;

  readonly issueTypes: IssueType[] = [
    'Bug',
    'Task',
    'Story'
  ];

  readonly priorities: Priority[] = [
    'Critical',
    'High',
    'Medium',
    'Low'
  ];

  readonly storyPointOptions: StoryPoints[] = [
    1, 2, 3, 5, 8
  ];

  // Only the title is required.
  // Description, due date and assignee are optional.
  readonly form = this.fb.nonNullable.group({
    title: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.minLength(5)
    ]),

    description: this.fb.nonNullable.control(''),

    type: this.fb.nonNullable.control<IssueType>(
      'Task',
      Validators.required
    ),

    priority: this.fb.nonNullable.control<Priority>(
      'Medium',
      Validators.required
    ),

    storyPoints: this.fb.nonNullable.control<StoryPoints>(
      3,
      Validators.required
    ),

    dueDate: this.fb.nonNullable.control(''),

    assigneeId: this.fb.nonNullable.control('')
  });

  get titleControl() {
    return this.form.controls.title;
  }

  get descriptionControl() {
    return this.form.controls.description;
  }

  get dueDateControl() {
    return this.form.controls.dueDate;
  }

  // Public because the HTML template uses this method.
  getToday(): string {
    const date = new Date();

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  submitIssue(): void {

    this.errorMessage.set('');

    this.form.markAllAsTouched();

    const value = this.form.getRawValue();

    if (!value.title.trim()) {
      this.titleControl.setErrors({ required: true });
      return;
    }

    if (value.title.trim().length < 5) {
      this.titleControl.setErrors({ minlength: true });
      return;
    }

    if (this.form.invalid) {
      return;
    }

    if (value.dueDate && value.dueDate < this.getToday()) {
      this.errorMessage.set('Due date cannot be in the past.');
      return;
    }

    const newIssue: NewIssue = {
      title: value.title.trim(),
      description: value.description.trim(),
      type: value.type,
      priority: value.priority,
      storyPoints: value.storyPoints,
      dueDate: value.dueDate || null,
      assigneeId: value.assigneeId || null
    };

    const result = this.store.createIssue(newIssue);

    if (!result.success) {
      this.errorMessage.set(result.message);
      return;
    }

    this.form.reset({
      title: '',
      description: '',
      type: 'Task',
      priority: 'Medium',
      storyPoints: 3,
      dueDate: '',
      assigneeId: ''
    });

    this.created.emit();
    this.closed.emit();
  }

  closeForm(): void {
    this.closed.emit();
  }
}
