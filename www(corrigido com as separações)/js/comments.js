/* comments.js — sistema de comentários e avaliações para postos */

class CommentSystem {
    constructor() {
      this.comments = {};
    }
    
    // Adicionar comentário
    async addComment(stationId, userId, userName, rating, text) {
        try {
          const commentData = {
            station_id: stationId,
            user_id: userId,
            user_name: userName || 'Anônimo',
            rating: rating || null,
            text: text || '',
            date: Date.now(),
            is_public: true
          };
          
          // Usa a função global definida em data.js
          const comment = await addCommentToStation(stationId, commentData);
          
          // Emitir evento (se usar sistema de eventos)
          if (typeof dbEventEmitter !== 'undefined') {
            dbEventEmitter.emit('comment:added', { stationId, comment });
          }
          
          // Atualizar o popup imediatamente
          updateStationPopupComments(stationId);
          
          showToast('✅ Comentário adicionado com sucesso!');
          return comment;
        } catch (error) {
          console.error('❌ Erro ao adicionar comentário:', error);
          showToast('❌ Erro ao adicionar comentário');
          throw error;
        }
      }
    
    // Obter comentários de um posto
    getComments(stationId) {
        // Usar a variável global stationComments de data.js
        return window.stationComments ? (window.stationComments[stationId] || []) : [];
      }
    
    // Calcular média de avaliações
    getAverageRating(stationId) {
        const comments = this.getComments(stationId);
        const ratedComments = comments.filter(c => c.rating && c.rating >= 1 && c.rating <= 5);
        
        if (ratedComments.length === 0) return { average: 0, count: 0 };
        
        const sum = ratedComments.reduce((total, c) => total + c.rating, 0);
        const average = sum / ratedComments.length;
        
        return {
            average: parseFloat(average.toFixed(1)),
            count: ratedComments.length
        };
    }
    
    // Renderizar estrelas
    renderStars(rating, interactive = false, size = 'medium') {
      const sizeClass = `stars-${size}`;
      let html = `<div class="rating-stars ${sizeClass} ${interactive ? 'interactive' : ''}" data-rating="${rating || 0}">`;
      
      for (let i = 1; i <= 5; i++) {
        const starClass = i <= (rating || 0) ? 'fas fa-star' : 'far fa-star';
        html += `<i class="${starClass}" data-value="${i}" style="color: ${i <= (rating || 0) ? '#ffc107' : '#ccc'}"></i>`;
      }
      
      html += '</div>';
      return html;
    }
    
    // Renderizar formulário de comentário
    renderCommentForm(stationId) {
      const isLoggedIn = !!currentUser;
      const userName = currentUser ? currentUser.name : 'Anônimo';
      
      return `
        <div class="comment-form-container">
          <h4 style="margin: 12px 0 8px 0; color: #333;">Deixe sua avaliação</h4>
          
          <div class="rating-input">
            <label style="font-size: 12px; color: #666;">Sua avaliação:</label>
            <div class="stars-rating-input" id="stars-${stationId}">
              <i class="far fa-star" data-value="1"></i>
              <i class="far fa-star" data-value="2"></i>
              <i class="far fa-star" data-value="3"></i>
              <i class="far fa-star" data-value="4"></i>
              <i class="far fa-star" data-value="5"></i>
            </div>
            <span id="rating-text-${stationId}" style="font-size: 12px; color: #666; margin-left: 8px;">0/5</span>
          </div>
          
          <div style="margin: 10px 0;">
            <textarea 
              id="comment-text-${stationId}" 
              placeholder="${isLoggedIn ? `Digite seu comentário, ${userName}...` : 'Digite seu comentário (você aparecerá como Anônimo)...'}"
              style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; min-height: 60px;"
            ></textarea>
          </div>
          
          <button 
            onclick="submitComment('${stationId}')"
            style="background: #1976d2; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600;"
          >
            <i class="fas fa-paper-plane"></i> Enviar Comentário
          </button>
          
          <div style="font-size: 11px; color: #777; margin-top: 8px;">
            ${isLoggedIn ? `Seu comentário aparecerá como: <strong>${escapeHtml(userName)}</strong>` : 'Seu comentário aparecerá como: <strong>Anônimo</strong>'}
          </div>
        </div>
      `;
    }
    
    // Renderizar lista de comentários
    renderCommentsList(stationId) {
      const comments = this.getComments(stationId);
      
      if (comments.length === 0) {
        return `
          <div class="no-comments" style="text-align: center; padding: 20px; color: #777;">
            <i class="fas fa-comment-slash" style="font-size: 24px; margin-bottom: 8px;"></i>
            <p style="margin: 0;">Nenhum comentário ainda. Seja o primeiro a avaliar!</p>
          </div>
        `;
      }
      
      let html = `<div class="comments-list" style="max-height: 300px; overflow-y: auto;">`;
      
      comments.forEach(comment => {
        const date = new Date(comment.date);
        const formattedDate = date.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        html += `
          <div class="comment-item" style="border-bottom: 1px solid #eee; padding: 12px 0; margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <strong style="font-size: 13px; color: #333;">${escapeHtml(comment.user_name)}</strong>
                ${comment.rating ? this.renderStars(comment.rating, false, 'small') : '<span style="color: #777; font-size: 11px;">(Sem avaliação)</span>'}
              </div>
              <small style="color: #999; font-size: 10px;">${formattedDate}</small>
            </div>
            
            ${comment.text ? `<div style="margin-top: 8px; font-size: 13px; color: #444; line-height: 1.4;">${escapeHtml(comment.text)}</div>` : ''}
          </div>
        `;
      });
      
      html += '</div>';
      return html;
    }
    
    // Renderizar resumo de avaliações
    renderRatingSummary(stationId) {
      const rating = this.getAverageRating(stationId);
      
      if (rating.count === 0) {
        return `
          <div style="background: #f8f9fa; padding: 8px; border-radius: 6px; margin-bottom: 12px;">
            <div style="color: #777; font-size: 12px;">
              <i class="fas fa-star" style="color: #ccc;"></i>
              Este posto ainda não foi avaliado
            </div>
          </div>
        `;
      }
      
      return `
        <div style="background: #f8f9fa; padding: 8px; border-radius: 6px; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>
              <strong style="font-size: 18px; color: #333;">${rating.average.toFixed(1)}</strong>
              <span style="color: #777; font-size: 12px;">/5</span>
              ${this.renderStars(rating.average, false, 'small')}
            </div>
            <div style="text-align: right;">
              <div style="font-size: 11px; color: #777;">Baseado em</div>
              <strong style="color: #1976d2;">${rating.count}</strong>
              <span style="font-size: 11px; color: #777;"> avaliação${rating.count !== 1 ? 'ões' : ''}</span>
            </div>
          </div>
        </div>
      `;
    }
  }
  
  // Instância global do sistema de comentários
  const commentSystem = new CommentSystem();
  
  // Função global para submeter comentário
  async function submitComment(stationId) {
    const starsContainer = document.getElementById(`stars-${stationId}`);
    const ratingText = document.getElementById(`rating-text-${stationId}`);
    const commentText = document.getElementById(`comment-text-${stationId}`);
    
    if (!starsContainer || !commentText) {
      console.error('❌ Elementos do formulário de comentário não encontrados');
      return;
    }
    
    // Obter avaliação selecionada
    const selectedStars = starsContainer.querySelectorAll('.fas.fa-star');
    const rating = selectedStars.length;
    
    // Obter texto do comentário
    const text = commentText.value.trim();
    
    if (text === '' && rating === 0) {
      showToast('❌ Adicione uma avaliação ou um comentário');
      return;
    }
    
    // Preparar dados do usuário
    const userId = currentUser ? currentUser.id : null;
    const userName = currentUser ? currentUser.name : null;
    
    console.log('📝 Enviando comentário:', { stationId, userId, userName, rating, text });
    
    try {
      // Adicionar comentário
      await commentSystem.addComment(stationId, userId, userName, rating, text);
      
      // Limpar formulário
      if (commentText) commentText.value = '';
      
      // Resetar estrelas
      if (starsContainer) {
        const stars = starsContainer.querySelectorAll('i');
        stars.forEach(star => {
          star.className = 'far fa-star';
          star.style.color = '#ccc';
        });
      }
      
      if (ratingText) ratingText.textContent = '0/5';
      
      console.log('✅ Comentário enviado com sucesso');
      
    } catch (error) {
      console.error('Erro ao enviar comentário:', error);
      showToast('❌ Erro ao enviar comentário');
    }
  }
  
  // Função para inicializar estrelas interativas
  function initStarRating(stationId) {
    const starsContainer = document.getElementById(`stars-${stationId}`);
    const ratingText = document.getElementById(`rating-text-${stationId}`);
    
    if (!starsContainer || !ratingText) return;
    
    const stars = starsContainer.querySelectorAll('i');
    let currentRating = 0;
    
    stars.forEach(star => {
      // Evento de mouse sobre a estrela
      star.addEventListener('mouseover', function() {
        const value = parseInt(this.getAttribute('data-value'));
        
        // Atualizar visual das estrelas
        stars.forEach((s, index) => {
          if (index < value) {
            s.className = 'fas fa-star';
            s.style.color = '#ffc107';
          } else {
            s.className = 'far fa-star';
            s.style.color = '#ccc';
          }
        });
        
        // Atualizar texto
        ratingText.textContent = `${value}/5`;
      });
      
      // Evento de clique na estrela
      star.addEventListener('click', function() {
        currentRating = parseInt(this.getAttribute('data-value'));
        
        // Manter as estrelas selecionadas após clique
        stars.forEach((s, index) => {
          if (index < currentRating) {
            s.className = 'fas fa-star';
            s.style.color = '#ffc107';
          } else {
            s.className = 'far fa-star';
            s.style.color = '#ccc';
          }
        });
        
        // Atualizar texto
        ratingText.textContent = `${currentRating}/5`;
      });
      
      // Evento de mouse sair do container
      starsContainer.addEventListener('mouseleave', function() {
        // Restaurar para a avaliação atual (se houver)
        stars.forEach((s, index) => {
          if (index < currentRating) {
            s.className = 'fas fa-star';
            s.style.color = '#ffc107';
          } else {
            s.className = 'far fa-star';
            s.style.color = '#ccc';
          }
        });
        
        ratingText.textContent = currentRating > 0 ? `${currentRating}/5` : '0/5';
      });
    });
  }
  
  // Função para atualizar popup do posto com novos comentários
  function updateStationPopupComments(stationId) {
    const station = gasData.find(s => s.id === stationId);
    if (!station) return;
    
    // Encontrar o marcador do posto
    gasMarkers.eachLayer(function(layer) {
      if (layer.stationId === stationId) {
        // Atualizar conteúdo do popup
        const popupContent = createStationPopupContent(station);
        layer.setPopupContent(popupContent);
        
        // Inicializar estrelas interativas
        setTimeout(() => {
          initStarRating(stationId);
        }, 100);
        
        return;
      }
    });
  }
  
  // Torna as funções globais
  window.commentSystem = commentSystem;
  window.submitComment = submitComment;
  window.initStarRating = initStarRating;