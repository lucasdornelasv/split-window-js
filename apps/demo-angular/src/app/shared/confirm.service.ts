import { DOCUMENT, Injectable, inject } from '@angular/core';

/**
 * Minimal confirmation dialog built on `<dialog>`, standing in for an ng-bootstrap modal in
 * `canClose` examples. The dialog lives in the body, outside the container shells.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly document = inject(DOCUMENT);

  confirm(message: string): Promise<boolean> {
    const dialog = this.document.createElement('dialog');
    dialog.className = 'demo-confirm';
    dialog.innerHTML = `
      <p class="demo-confirm__message"></p>
      <div class="demo-actions">
        <button type="button" class="demo-button primary" data-answer="yes">Sim</button>
        <button type="button" class="demo-button" data-answer="no">Não</button>
      </div>`;
    dialog.querySelector('.demo-confirm__message')!.textContent = message;
    this.document.body.appendChild(dialog);
    dialog.showModal();
    return new Promise<boolean>((resolve) => {
      const finish = (answer: boolean) => {
        dialog.close();
        dialog.remove();
        resolve(answer);
      };
      dialog.addEventListener('click', (event) => {
        const answer = (event.target as HTMLElement).dataset['answer'];
        if (answer) finish(answer === 'yes');
      });
      // Esc closes the dialog: it is handled here and never reaches an expanded shell.
      dialog.addEventListener('cancel', (event) => {
        event.preventDefault();
        finish(false);
      });
    });
  }
}
