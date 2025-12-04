export class UIService {
  constructor() {
    this.toastElement = document.getElementById('toast');
    this.sidebarElement = document.getElementById('sidebar');
  }

  showToast(message, type = 'info') {
    if (!this.toastElement) return;
    
    this.toastElement.textContent = message;
    this.toastElement.className = `toast ${type}`;
    this.toastElement.classList.remove('hidden');
    
    setTimeout(() => {
      this.toastElement.classList.add('hidden');
    }, 3000);
  }

  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.add('hidden');
    });
    
    const screen = document.getElementById(screenId);
    if (screen) {
      screen.classList.remove('hidden');
    }
  }

  showRouteStations(stations) {
    if (!this.sidebarElement) return;
    
    const listElement = this.sidebarElement.querySelector('#routeSidebarList');
    if (listElement) {
      listElement.innerHTML = stations.map(station => `
        <li class="station-item" data-id="${station.id}">
          <div class="station-info">
            <span class="name">${this.escapeHtml(station.name)}</span>
            <span class="trust">${station.trustScore}/10</span>
          </div>
          <span class="price">R$ ${station.prices?.gas || '--'}</span>
        </li>
      `).join('');
    }
    
    this.sidebarElement.classList.remove('hidden');
  }

  askToEnableDriverMode(stationCount) {
    setTimeout(() => {
      if (confirm(`Encontramos ${stationCount} postos na sua rota! Deseja ativar o modo motorista?`)) {
        this.emitEvent('enable-driver-mode');
      }
    }, 1000);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  emitEvent(eventName, data = {}) {
    const event = new CustomEvent(eventName, { detail: data });
    document.dispatchEvent(event);
  }
}