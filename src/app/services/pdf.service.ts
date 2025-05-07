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
}
