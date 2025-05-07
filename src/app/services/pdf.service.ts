import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Question } from '../models/question.model';
import { saveAs } from 'file-saver';

@Injectable({
  providedIn: 'root',
})
export class PdfService {
  private apiUrl = 'http://localhost:3000/api/pdf';

  constructor(private http: HttpClient) {}

  extractQuestionsFromPdf(
    pdfFile: File,
    difficulty: string,
    count: number
  ): Observable<{ questions: Question[] }> {
    const formData = new FormData();
    formData.append('pdf', pdfFile);
    formData.append('difficulty', difficulty);
    formData.append('count', count.toString());

    return this.http.post<{ questions: Question[] }>(
      `${this.apiUrl}/extract-questions`,
      formData
    );
  }

  generatePdf(questions: Question[], title: string): Observable<Blob> {
    return this.http.post(
      `${this.apiUrl}/generate-pdf`,
      { questions, title },
      { responseType: 'blob' }
    );
  }

  downloadPdf(questions: Question[], title: string = 'Questionario'): void {
    this.generatePdf(questions, title).subscribe((blob) => {
      saveAs(blob, `${title}.pdf`);
    });
  }

  extractTextFromPdf(pdfFile: File): Observable<{ text: string }> {
    const formData = new FormData();
    formData.append('pdf', pdfFile);

    return this.http.post<{ text: string }>(
      'http://localhost:3000/api/pdf/extract-text',
      formData
    );
  }

  downloadQuizAndAnswerKey(
    questions: Question[],
    title: string,
    format: 'pdf' | 'docx' | 'xlsx'
  ): void {
    this.generateQuizAndAnswerKey(questions, title, format).subscribe(
      (response: any) => {
        const quizBlob = this.base64ToBlob(
          response.quiz,
          this.getMimeType(format)
        );
        const answerKeyBlob = this.base64ToBlob(
          response.answerKey,
          this.getMimeType(format)
        );
        saveAs(quizBlob, `${title}.${format}`);
        saveAs(answerKeyBlob, `${title}_Gabarito.${format}`);
      }
    );
  }

  base64ToBlob(base64: string, mime: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mime });
  }

  generateQuizAndAnswerKey(
    questions: Question[],
    title: string,
    format: string
  ): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/generate-quiz-and-answer-key`,
      { questions, title, format },
      { responseType: 'json' }
    );
  }

  getMimeType(format: string): string {
    switch (format) {
      case 'pdf':
        return 'application/pdf';
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      default:
        return 'application/octet-stream';
    }
  }
}
