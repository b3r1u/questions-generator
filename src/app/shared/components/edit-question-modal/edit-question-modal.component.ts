import { Component, Inject } from '@angular/core';
import { Question } from '../../../models/question.model';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-edit-question-modal',
  templateUrl: './edit-question-modal.component.html',
  styleUrls: ['./edit-question-modal.component.scss'],
})
export class EditQuestionModalComponent {
  editedQuestion: Question;

  constructor(
    public dialogRef: MatDialogRef<EditQuestionModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { question: Question }
  ) {
    this.editedQuestion = JSON.parse(JSON.stringify(data.question));
    this.editedQuestion.options = this.editedQuestion.options || [];
  }

  getOptionLetter(index: number): string {
    return String.fromCharCode(97 + index);
  }

  setCorrectAnswer(index: number): void {
    this.editedQuestion.correctAnswer = index;
  }

  onSave(): void {
    this.dialogRef.close(this.editedQuestion);
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
