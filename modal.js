// Custom Modal System to replace alert()

class Modal {
  constructor() {
    this.overlay = null;
    this.modal = null;
    this.onConfirm = null;
    this.onCancel = null;
    this.initialized = false;
    this.pendingShows = [];
  }

  init() {
    if (this.initialized) return;

    // Create modal elements
    const overlay = document.createElement('div');
    overlay.id = 'modal-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      backdrop-filter: blur(4px);
    `;

    const modal = document.createElement('div');
    modal.id = 'modal';
    modal.style.cssText = `
      background: var(--paper, #F7F6F1);
      border-radius: 16px;
      padding: 24px;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
      animation: modalSlideIn 0.2s ease-out;
    `;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes modalSlideIn {
        from {
          opacity: 0;
          transform: translateY(20px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      @media (prefers-color-scheme: dark) {
        #modal {
          background: var(--paper, #1C1B17);
        }
      }
    `;

    document.head.appendChild(style);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    this.overlay = overlay;
    this.modal = modal;
    this.initialized = true;

    // Process any pending shows
    while (this.pendingShows.length > 0) {
      const options = this.pendingShows.shift();
      this.show(options);
    }
  }

  show(options) {
    // If not initialized, wait for DOM to be ready
    if (!this.initialized) {
      if (document.readyState === 'loading' || !document.body) {
        this.pendingShows.push(options);
        if (this.pendingShows.length === 1) {
          // Only add listener once
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
          } else {
            // DOM is ready but body doesn't exist (edge case)
            setTimeout(() => this.init(), 10);
          }
        }
        return;
      } else {
        this.init();
      }
    }

    const {
      title = 'Confirm',
      message = '',
      confirmText = 'Yes',
      cancelText = 'No',
      onConfirm = null,
      onCancel = null,
      showCancel = true
    } = options;

    this.onConfirm = onConfirm;
    this.onCancel = onCancel;

    this.modal.innerHTML = `
      <h2 style="font-size: 1.4rem; margin-bottom: 12px; color: var(--ink, #1C1B17);">${title}</h2>
      <p style="font-size: 0.95rem; color: var(--ink-soft, #6B6A61); margin-bottom: 20px; line-height: 1.5;">${message}</p>
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        ${showCancel ? `<button id="modal-cancel" style="padding: 10px 20px; border: 1.5px solid var(--line, #E2E0D6); background: var(--paper, #F7F6F1); color: var(--ink, #1C1B17); border-radius: 8px; font-family: 'Inter', sans-serif; font-size: 0.9rem; font-weight: 500; cursor: pointer; transition: all 0.15s ease;">${cancelText}</button>` : ''}
        <button id="modal-confirm" style="padding: 10px 20px; background: var(--green, #2F5233); color: var(--paper, #F7F6F1); border: none; border-radius: 8px; font-family: 'Inter', sans-serif; font-size: 0.9rem; font-weight: 500; cursor: pointer; transition: all 0.15s ease;">${confirmText}</button>
      </div>
    `;

    // Add hover effects
    const confirmBtn = document.getElementById('modal-confirm');
    const cancelBtn = document.getElementById('modal-cancel');

    if (confirmBtn) {
      confirmBtn.addEventListener('mouseenter', () => {
        confirmBtn.style.transform = 'translateY(-1px)';
        confirmBtn.style.boxShadow = '0 4px 12px rgba(47, 82, 51, 0.3)';
      });
      confirmBtn.addEventListener('mouseleave', () => {
        confirmBtn.style.transform = 'translateY(0)';
        confirmBtn.style.boxShadow = 'none';
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('mouseenter', () => {
        cancelBtn.style.background = 'var(--line, #E2E0D6)';
      });
      cancelBtn.addEventListener('mouseleave', () => {
        cancelBtn.style.background = 'var(--paper, #F7F6F1)';
      });
    }

    // Event listeners
    confirmBtn.addEventListener('click', () => this.handleConfirm());
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.handleCancel());
    }

    // Close on overlay click
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.handleCancel();
      }
    });

    // Close on Escape key
    this.escapeHandler = (e) => {
      if (e.key === 'Escape') {
        this.handleCancel();
      }
    };
    document.addEventListener('keydown', this.escapeHandler);

    // Show modal
    this.overlay.style.display = 'flex';
  }

  handleConfirm() {
    this.hide();
    if (this.onConfirm) {
      this.onConfirm();
    }
  }

  handleCancel() {
    this.hide();
    if (this.onCancel) {
      this.onCancel();
    }
  }

  hide() {
    this.overlay.style.display = 'none';
    document.removeEventListener('keydown', this.escapeHandler);
  }
}

// Global instance - initialize lazily
let modalInstance = null;

function getModal() {
  if (!modalInstance) {
    modalInstance = new Modal();
  }
  return modalInstance;
}

// Convenience function
function showConfirm(options) {
  return new Promise((resolve) => {
    const modal = getModal();
    modal.show({
      ...options,
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false)
    });
  });
}

function showAlert(options) {
  return new Promise((resolve) => {
    const modal = getModal();
    modal.show({
      ...options,
      showCancel: false,
      onConfirm: () => resolve(true)
    });
  });
}
