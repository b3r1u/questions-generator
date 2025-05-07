import { Component } from '@angular/core';
import { PdfService } from 'src/app/services/pdf.service';
import { Question } from 'src/app/models/question.model';

@Component({
  selector: 'app-pdf-upload',
  templateUrl: './pdf-upload.component.html',
  styleUrls: ['./pdf-upload.component.scss'],
})
export class PdfUploadComponent {
  selectedFile: File | null = null;
  questions: Question[] = [];
  isLoading = false;
  error = '';
  showDownloadOptions = false;
  pdfText: string = '';
  selectedFormat = 'pdf' as 'pdf' | 'docx' | 'xlsx';

  generationOptions = {
    difficulty: 'medium' as 'easy' | 'medium' | 'hard',
    count: 5,
  };

  questionnaireTitle = 'Questionário Gerado';

  constructor(private pdfService: PdfService) {}

  onFileSelected(event: any): void {
    this.selectedFile = event.target.files[0];
    this.error = '';
  }

  extractQuestions(): void {
    if (!this.selectedFile) {
      this.error = 'Por favor, selecione um arquivo PDF';
      return;
    }

    this.isLoading = true;
    this.error = '';

    this.pdfService
      .extractQuestionsFromPdf(
        this.selectedFile,
        this.generationOptions.difficulty,
        this.generationOptions.count
      )
      .subscribe({
        next: (response) => {
          this.questions = response.questions;
          this.isLoading = false;
          this.showDownloadOptions = true;
        },
        error: (err) => {
          this.error = 'Erro ao processar o PDF. Por favor, tente novamente.';
          this.isLoading = false;
          console.error(err);
        },
      });
  }

  downloadPdf(): void {
    if (this.questions.length === 0) return;
    this.pdfService.downloadPdf(this.questions, this.questionnaireTitle);
  }

  removeQuestion(index: number): void {
    this.questions.splice(index, 1);
  }

  trackByFn(index: number, item: Question): number {
    return index;
  }

  getOptionLetter(index: number): string {
    return String.fromCharCode(97 + index);
  }

  testExtractText(): void {
    if (!this.selectedFile) {
      this.error = 'Por favor, selecione um arquivo PDF';
      return;
    }
    this.isLoading = true;
    this.error = '';
    this.pdfService.extractTextFromPdf(this.selectedFile).subscribe({
      next: (response) => {
        this.pdfText = response.text;
        this.isLoading = false;
        console.log(this.pdfText);
      },
      error: (err) => {
        this.error = 'Erro ao extrair texto do PDF.';
        this.isLoading = false;
        console.error(err);
      },
    });
  }

  downloadQuizAndAnswerKey() {
    if (this.questions.length === 0) return;
    this.pdfService.downloadQuizAndAnswerKey(
      this.questions,
      this.questionnaireTitle,
      this.selectedFormat
    );
  }

  limparLetra(text: string): string {
    return text.replace(/^[a-zA-Z0-9][\)\.]\s*/g, '').trim();
  }
}
