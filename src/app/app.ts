import { Component, ChangeDetectionStrategy } from '@angular/core';
import { BoardComponent } from './features/issues/pages/board/board';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [BoardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {}