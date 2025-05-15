import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { EditQuestionModalComponent } from '../shared/components/edit-question-modal/edit-question-modal.component';
import { Question } from '../models/question.model';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ModalService {
  constructor(private dialog: MatDialog) {}

  async openEditQuestionModal(
    question: Question,
    index: number
  ): Promise<Question | undefined> {
    const dialogRef = this.dialog.open(EditQuestionModalComponent, {
      width: '600px',
      data: { question, index },
    });

    return await firstValueFrom(dialogRef.afterClosed());
  }
}
