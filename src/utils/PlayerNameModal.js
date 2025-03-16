class PlayerNameModal {
  constructor() {
    this.onSubmitCallback = null;
    this.modalElement = null;
  }

  // Create and show the modal
  show() {
    // Check if modal already exists
    if (this.modalElement) {
      this.modalElement.style.display = 'flex';
      return;
    }

    // Create modal container
    this.modalElement = document.createElement('div');
    this.modalElement.className = 'player-name-modal';
    this.modalElement.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    `;

    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'player-name-modal-content';
    modalContent.style.cssText = `
      background-color: white;
      padding: 20px;
      border-radius: 5px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      width: 300px;
      max-width: 90%;
      text-align: center;
    `;

    // Create title
    const title = document.createElement('h2');
    title.textContent = 'Enter Your Name';
    title.style.cssText = `
      margin-top: 0;
      color: #333;
    `;

    // Create input
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Your Name';
    input.className = 'player-name-input';
    input.style.cssText = `
      width: 100%;
      padding: 10px;
      margin: 15px 0;
      border: 1px solid #ccc;
      border-radius: 3px;
      box-sizing: border-box;
      font-size: 16px;
    `;

    // Create enter button
    const button = document.createElement('button');
    button.textContent = 'Enter';
    button.className = 'enter-button';
    button.style.cssText = `
      background-color: #4CAF50;
      color: white;
      border: none;
      padding: 10px 20px;
      text-align: center;
      text-decoration: none;
      display: inline-block;
      font-size: 16px;
      margin: 4px 2px;
      cursor: pointer;
      border-radius: 3px;
    `;

    // Add button event listener
    button.addEventListener('click', () => this.handleSubmit(input.value));
    
    // Add keypress listener for Enter key
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handleSubmit(input.value);
      }
    });

    // Assemble modal
    modalContent.appendChild(title);
    modalContent.appendChild(input);
    modalContent.appendChild(button);
    this.modalElement.appendChild(modalContent);

    // Add to document
    document.body.appendChild(this.modalElement);
    
    // Focus the input field
    setTimeout(() => input.focus(), 100);
  }

  // Handle submit button or Enter key
  handleSubmit(name) {
    // Validate name
    if (!name || name.trim() === '') {
      alert('Please enter a name');
      return;
    }

    // Hide modal
    this.hide();

    // Call callback with name
    if (this.onSubmitCallback) {
      this.onSubmitCallback(name.trim());
    }
  }

  // Hide the modal
  hide() {
    if (this.modalElement) {
      this.modalElement.style.display = 'none';
    }
  }

  // Set submit callback
  onSubmit(callback) {
    this.onSubmitCallback = callback;
  }

  // Clean up
  destroy() {
    if (this.modalElement) {
      document.body.removeChild(this.modalElement);
      this.modalElement = null;
    }
  }
}

export default PlayerNameModal; 