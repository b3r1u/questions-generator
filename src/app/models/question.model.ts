export type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer';

export interface Question {
  id?: string;
  type: QuestionType;
  text: string;
  options: string[];
  correctAnswer?: number | string;
  difficulty?: 'easy' | 'medium' | 'hard';
  category?: string;
}