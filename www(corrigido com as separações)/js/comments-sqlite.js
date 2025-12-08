/* comments-sqlite.js — sistema de comentários usando SQLite */
console.log('💬 Inicializando sistema de comentários SQLite...');

const commentSystem = {
    // Buscar comentários de um posto
    getComments: function(stationId) {
        if (!stationComments[stationId]) {
            return [];
        }
        return stationComments[stationId].sort((a, b) => b.date - a.date);
    },
    
    // Adicionar novo comentário
    addComment: async function(stationId, userId, userName, rating, text) {
        try {
            const newComment = {
                id: `comment_${Date.now()}`,
                station_id: stationId,
                user_id: userId || 'anonymous',
                user_name: userName || 'Usuário Anônimo',
                rating: rating || 0,
                text: text || '',
                date: Date.now(),
                is_public: 1
            };
            
            // Adicionar ao objeto local
            if (!stationComments[stationId]) {
                stationComments[stationId] = [];
            }
            stationComments[stationId].unshift(newComment);
            
            // Salvar no SQLite
            if (window.sqlDB && sqlDB.initialized) {
                await sqlDB.addComment(newComment);
            }
            
            // Atualizar média de avaliações
            this.updateStationAverageRating(stationId);
            
            // Salvar dados
            await saveData();
            
            // Sincronizar com Firebase se disponível
            if (window.firebaseSync && firebaseSync.currentFirebaseUser) {
                firebaseSync.syncCommentToFirebase(newComment, stationId);
            }
            
            console.log('✅ Comentário adicionado:', newComment);
            return newComment;
            
        } catch (error) {
            console.error('❌ Erro ao adicionar comentário:', error);
            throw error;
        }
    },
    
    // Calcular média de avaliações
    getAverageRating: function(stationId) {
        const comments = this.getComments(stationId);
        if (comments.length === 0) {
            return { average: 0, count: 0 };
        }
        
        const ratings = comments.filter(c => c.rating > 0).map(c => c.rating);
        if (ratings.length === 0) {
            return { average: 0, count: 0 };
        }
        
        const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
        
        return {
            average: parseFloat(average.toFixed(1)),
            count: ratings.length
        };
    },
    
    // Atualizar média no posto
    updateStationAverageRating: function(stationId) {
        const ratingInfo = this.getAverageRating(stationId);
        const station = gasData.find(s => s.id === stationId);
        
        if (station) {
            if (!station.ratings) station.ratings = {};
            station.ratings.average = ratingInfo.average;
            station.ratings.count = ratingInfo.count;
            
            // Atualizar no SQLite
            if (window.sqlDB && sqlDB.initialized) {
                sqlDB.updateStation(station);
            }
        }
    },
    
    // Renderizar resumo de avaliações
    renderRatingSummary: function(stationId) {
        const ratingInfo = this.getAverageRating(stationId);
        
        if (ratingInfo.count === 0) {
            return '<div style="color:#666; font-size:11px;">Sem avaliações</div>';
        }
        
        const stars = this.renderStars(ratingInfo.average);
        
        return `
            <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                <div style="display: flex; color: #ffb400;">
                    ${stars}
                </div>
                <span style="font-size: 11px; color: #666;">
                    ${ratingInfo.average.toFixed(1)} (${ratingInfo.count} avaliações)
                </span>
            </div>
        `;
    },
    
    // Renderizar estrelas
    renderStars: function(rating) {
        let stars = '';
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        
        for (let i = 1; i <= 5; i++) {
            if (i <= fullStars) {
                stars += '<i class="fas fa-star"></i>';
            } else if (i === fullStars + 1 && hasHalfStar) {
                stars += '<i class="fas fa-star-half-alt"></i>';
            } else {
                stars += '<i class="far fa-star"></i>';
            }
        }
        
        return stars;
    },
    
    // Renderizar formulário de comentário
    renderCommentForm: function(stationId) {
        return `
            <div class="comment-form" style="margin-bottom: 12px;">
                <div style="display: flex; align-items: center; margin-bottom: 8px;">
                    <div class="star-rating" id="starRating_${stationId}">
                        <span class="star" data-value="1">★</span>
                        <span class="star" data-value="2">★</span>
                        <span class="star" data-value="3">★</span>
                        <span class="star" data-value="4">★</span>
                        <span class="star" data-value="5">★</span>
                    </div>
                    <span id="ratingText_${stationId}" style="margin-left: 8px; font-size: 12px; color: #666;">
                        Selecione uma nota
                    </span>
                </div>
                
                <textarea id="commentText_${stationId}" 
                          placeholder="Deixe seu comentário (opcional)" 
                          style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; resize: vertical; min-height: 60px;">
                </textarea>
                
                <button onclick="submitComment('${stationId}')" 
                        style="width: 100%; padding: 8px; background: #1976d2; color: white; border: none; border-radius: 4px; margin-top: 8px; cursor: pointer;">
                    <i class="fas fa-paper-plane"></i> Enviar Avaliação
                </button>
            </div>
        `;
    },
    
    // Renderizar lista de comentários
    renderCommentsList: function(stationId, limit = 5) {
        const comments = this.getComments(stationId);
        
        if (comments.length === 0) {
            return '<div style="text-align: center; color: #777; padding: 20px;">Nenhum comentário ainda</div>';
        }
        
        let html = '<div style="max-height: 200px; overflow-y: auto;">';
        
        comments.slice(0, limit).forEach(comment => {
            const date = new Date(comment.date).toLocaleDateString('pt-BR');
            const stars = this.renderStars(comment.rating || 0);
            
            html += `
                <div style="border-bottom: 1px solid #eee; padding: 8px 0;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <strong style="font-size: 12px;">${escapeHtml(comment.user_name)}</strong>
                        <span style="font-size: 10px; color: #666;">${date}</span>
                    </div>
                    ${comment.rating ? `<div style="color: #ffb400; font-size: 12px; margin-bottom: 4px;">${stars}</div>` : ''}
                    <div style="font-size: 12px; color: #333;">${escapeHtml(comment.text || '')}</div>
                </div>
            `;
        });
        
        if (comments.length > limit) {
            html += `
                <div style="text-align: center; padding: 8px;">
                    <small style="color: #1976d2; cursor: pointer;" onclick="loadMoreComments('${stationId}')">
                        Ver mais ${comments.length - limit} comentários
                    </small>
                </div>
            `;
        }
        
        html += '</div>';
        return html;
    }
};

// Funções auxiliares globais
window.initStarRating = function(stationId) {
    const container = document.getElementById(`starRating_${stationId}`);
    if (!container) return;
    
    const stars = container.querySelectorAll('.star');
    const ratingText = document.getElementById(`ratingText_${stationId}`);
    
    let currentRating = 0;
    
    stars.forEach(star => {
        // Evento de passar o mouse
        star.addEventListener('mouseover', function() {
            const value = parseInt(this.getAttribute('data-value'));
            highlightStars(value);
        });
        
        // Evento de clicar
        star.addEventListener('click', function() {
            currentRating = parseInt(this.getAttribute('data-value'));
            highlightStars(currentRating);
            updateRatingText(currentRating);
            
            // Salvar rating no sessionStorage para usar no submit
            sessionStorage.setItem(`rating_${stationId}`, currentRating);
        });
        
        // Evento de sair do container
        container.addEventListener('mouseleave', function() {
            highlightStars(currentRating);
        });
    });
    
    function highlightStars(count) {
        stars.forEach((star, index) => {
            if (index < count) {
                star.style.color = '#ffb400';
                star.classList.add('active');
            } else {
                star.style.color = '#ddd';
                star.classList.remove('active');
            }
        });
    }
    
    function updateRatingText(rating) {
        const texts = [
            'Péssimo',
            'Ruim',
            'Regular',
            'Bom',
            'Excelente'
        ];
        if (ratingText) {
            ratingText.textContent = texts[rating - 1] || 'Selecione uma nota';
            ratingText.style.color = '#1976d2';
        }
    }
};

window.submitComment = async function(stationId) {
    if (!currentUser && !confirm('Você está comentando como anônimo. Deseja continuar?')) {
        return;
    }
    
    const rating = parseInt(sessionStorage.getItem(`rating_${stationId}`)) || 0;
    const text = document.getElementById(`commentText_${stationId}`)?.value.trim() || '';
    
    if (rating === 0) {
        showToast('❌ Selecione uma avaliação com estrelas');
        return;
    }
    
    try {
        const userName = currentUser ? currentUser.name : 'Usuário Anônimo';
        const userId = currentUser ? currentUser.id : `anon_${getAnonId()}`;
        
        await commentSystem.addComment(stationId, userId, userName, rating, text);
        
        // Limpar formulário
        document.getElementById(`commentText_${stationId}`).value = '';
        sessionStorage.removeItem(`rating_${stationId}`);
        
        // Atualizar popup
        refreshStationComments(stationId);
        
        showToast('✅ Avaliação enviada com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao enviar comentário:', error);
        showToast('❌ Erro ao enviar avaliação');
    }
};

window.loadMoreComments = function(stationId) {
    // Função para carregar mais comentários
    const popup = document.querySelector('.leaflet-popup-content');
    if (popup) {
        const commentsSection = popup.querySelector('.comment-form')?.parentNode;
        if (commentsSection) {
            // Recarregar comentários sem limite
            const unlimitedComments = commentSystem.renderCommentsList(stationId, 50);
            const commentsDiv = commentsSection.querySelector('div:nth-child(3)');
            if (commentsDiv) {
                commentsDiv.innerHTML = unlimitedComments;
            }
        }
    }
};

// Inicializar sistema de comentários
window.commentSystem = commentSystem;

console.log('✅ Sistema de comentários SQLite pronto');