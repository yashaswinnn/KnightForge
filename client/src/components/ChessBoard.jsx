import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../lib/utils.js';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const PIECE_GLYPHS = {
  wK: '\u2654',
  wQ: '\u2655',
  wR: '\u2656',
  wB: '\u2657',
  wN: '\u2658',
  wP: '\u2659',
  bK: '\u265A',
  bQ: '\u265B',
  bR: '\u265C',
  bB: '\u265D',
  bN: '\u265E',
  bP: '\u265F',
};

function fenToBoardMap(fen) {
  const [placement] = (fen || STARTING_FEN).split(' ');
  const rows = placement.split('/');
  const board = {};

  rows.forEach((row, rowIndex) => {
    let col = 0;

    row.split('').forEach((char) => {
      if (/\d/.test(char)) {
        col += Number.parseInt(char, 10);
        return;
      }

      const color = char === char.toUpperCase() ? 'w' : 'b';
      const type = char.toUpperCase();
      const square = `${FILES[col]}${8 - rowIndex}`;
      board[square] = `${color}${type}`;
      col += 1;
    });
  });

  return board;
}

function squareToPosition(square, flipped) {
  const fileIndex = FILES.indexOf(square[0]);
  const rankIndex = 8 - Number.parseInt(square[1], 10);
  const x = flipped ? 7 - fileIndex : fileIndex;
  const y = flipped ? 7 - rankIndex : rankIndex;
  return { x, y };
}

function squareDistance(a, b) {
  const ax = FILES.indexOf(a[0]);
  const ay = Number.parseInt(a[1], 10);
  const bx = FILES.indexOf(b[0]);
  const by = Number.parseInt(b[1], 10);
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

function getCaptureExit(square) {
  const fileIndex = FILES.indexOf(square[0]);
  const rankIndex = 8 - Number.parseInt(square[1], 10);
  const targetX = fileIndex < 4 ? -1.35 : 8.35;
  const targetY = rankIndex < 4 ? -1.15 : 8.15;
  return { x: targetX, y: targetY };
}

function buildInitialSprites(boardMap, flipped, nextId) {
  return Object.entries(boardMap).map(([square, piece]) => {
    const id = nextId.current++;
    return {
      id,
      square,
      piece,
      ...squareToPosition(square, flipped),
      exiting: false,
    };
  });
}

function isPromotionMove(piece, toSquare) {
  if (!piece || piece[1] !== 'P') return false;
  return (piece[0] === 'w' && toSquare[1] === '8') || (piece[0] === 'b' && toSquare[1] === '1');
}

export function ChessBoard({ fen, flipped = false, legalMoves = [], onMove, lastMove = null, highlightCheck = null }) {
  const [selected, setSelected] = useState(null);
  const [sprites, setSprites] = useState([]);
  const [pendingPromotion, setPendingPromotion] = useState(null);
  const spriteIdRef = useRef(1);
  const cleanupTimersRef = useRef([]);
  const didInitRef = useRef(false);

  const boardMap = useMemo(() => fenToBoardMap(fen || STARTING_FEN), [fen]);

  useEffect(() => {
    return () => {
      cleanupTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    setPendingPromotion(null);
  }, [fen]);

  useEffect(() => {
    setSprites((previousSprites) => {
      if (!didInitRef.current) {
        didInitRef.current = true;
        return buildInitialSprites(boardMap, flipped, spriteIdRef);
      }

      const previousActive = previousSprites.filter((sprite) => !sprite.exiting);
      const previousBySquare = new Map(previousActive.map((sprite) => [sprite.square, sprite]));
      const nextSprites = [];
      const usedIds = new Set();
      const assignedSquares = new Set();
      const moveFrom = lastMove?.slice(0, 2);
      const moveTo = lastMove?.slice(2, 4);

      Object.entries(boardMap).forEach(([square, piece]) => {
        const existing = previousBySquare.get(square);
        if (existing && existing.piece === piece) {
          usedIds.add(existing.id);
          assignedSquares.add(square);
          nextSprites.push({
            ...existing,
            square,
            piece,
            ...squareToPosition(square, flipped),
            exiting: false,
          });
        }
      });

      if (moveFrom && moveTo && boardMap[moveTo]) {
        const movedSprite = previousBySquare.get(moveFrom);
        if (movedSprite && !usedIds.has(movedSprite.id) && !assignedSquares.has(moveTo)) {
          usedIds.add(movedSprite.id);
          assignedSquares.add(moveTo);
          nextSprites.push({
            ...movedSprite,
            square: moveTo,
            piece: boardMap[moveTo],
            ...squareToPosition(moveTo, flipped),
            exiting: false,
          });
        }
      }

      const remainingPrevious = previousActive.filter((sprite) => !usedIds.has(sprite.id));

      Object.entries(boardMap).forEach(([square, piece]) => {
        if (assignedSquares.has(square)) return;

        const samePieceCandidates = remainingPrevious
          .filter((sprite) => !usedIds.has(sprite.id) && sprite.piece === piece)
          .sort((a, b) => squareDistance(a.square, square) - squareDistance(b.square, square));

        const matched = samePieceCandidates[0];

        if (matched) {
          usedIds.add(matched.id);
          assignedSquares.add(square);
          nextSprites.push({
            ...matched,
            square,
            piece,
            ...squareToPosition(square, flipped),
            exiting: false,
          });
          return;
        }

        assignedSquares.add(square);
        nextSprites.push({
          id: spriteIdRef.current++,
          square,
          piece,
          ...squareToPosition(square, flipped),
          exiting: false,
        });
      });

      const exitingSprites = remainingPrevious
        .filter((sprite) => !usedIds.has(sprite.id))
        .map((sprite) => ({
          ...sprite,
          ...getCaptureExit(sprite.square),
          exiting: true,
        }));

      if (exitingSprites.length) {
        const exitingIds = exitingSprites.map((sprite) => sprite.id);
        const timer = window.setTimeout(() => {
          setSprites((current) => current.filter((sprite) => !exitingIds.includes(sprite.id)));
        }, 360);
        cleanupTimersRef.current.push(timer);
      }

      return [...nextSprites, ...previousSprites.filter((sprite) => sprite.exiting), ...exitingSprites];
    });
  }, [boardMap, flipped, lastMove]);

  const legalFrom = selected ? legalMoves.filter((move) => move.startsWith(selected)) : [];
  const legalTos = legalFrom.map((move) => move.slice(2, 4));

  const handlePromotionPick = useCallback((promotion) => {
    if (!pendingPromotion) return;
    onMove?.(`${pendingPromotion.from}${pendingPromotion.to}${promotion}`);
    setPendingPromotion(null);
    setSelected(null);
  }, [onMove, pendingPromotion]);

  const handlePromotionCancel = useCallback(() => {
    setPendingPromotion(null);
  }, []);

  const handleSquare = useCallback((square, piece) => {
    if (pendingPromotion) return;

    if (selected) {
      if (legalTos.includes(square)) {
        const movingPiece = boardMap[selected];

        if (isPromotionMove(movingPiece, square)) {
          setPendingPromotion({
            from: selected,
            to: square,
            color: movingPiece[0],
          });
          return;
        }

        onMove?.(selected + square);
        setSelected(null);
        return;
      }

      if (piece) {
        setSelected(square);
        return;
      }

      setSelected(null);
      return;
    }

    if (piece) {
      setSelected(square);
    }
  }, [boardMap, legalTos, onMove, pendingPromotion, selected]);

  const squares = [];
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const displayRow = flipped ? 7 - row : row;
      const displayCol = flipped ? 7 - col : col;
      const square = `${FILES[displayCol]}${8 - displayRow}`;
      const piece = boardMap[square];
      const isLight = (displayRow + displayCol) % 2 === 0;
      const isSelected = selected === square;
      const isLastMove = lastMove && (lastMove.slice(0, 2) === square || lastMove.slice(2, 4) === square);
      const isLegalMove = legalTos.includes(square);
      const isCapture = isLegalMove && !!piece;
      const isCheck = highlightCheck === square;
      const showRankLabel = col === 7;
      const showFileLabel = row === 7;

      squares.push(
        <div
          key={square}
          className={cn(
            'chess-square',
            isLight ? 'light-sq' : 'dark-sq',
            isSelected && 'selected',
            !isSelected && isLastMove && 'last-move',
            isCheck && 'in-check',
            isCapture && !isSelected && 'legal-capture',
            isLegalMove && !isCapture && !isSelected && 'legal-move',
            pendingPromotion && 'pointer-events-none'
          )}
          onClick={() => handleSquare(square, piece)}
        >
          {showFileLabel && (
            <span className="coord-label bottom-0.5 left-0.5" style={{ color: isLight ? '#b58863' : '#f0d9b5' }}>
              {FILES[displayCol]}
            </span>
          )}
          {showRankLabel && (
            <span className="coord-label top-0.5 right-0.5" style={{ color: isLight ? '#b58863' : '#f0d9b5' }}>
              {8 - displayRow}
            </span>
          )}
        </div>
      );
    }
  }

  const promotionOptions = pendingPromotion
    ? [
        { key: 'q', piece: `${pendingPromotion.color}Q` },
        { key: 'r', piece: `${pendingPromotion.color}R` },
        { key: 'b', piece: `${pendingPromotion.color}B` },
        { key: 'n', piece: `${pendingPromotion.color}N` },
      ]
    : [];

  return (
    <div className="chess-board select-none">
      <div className="chess-squares">{squares}</div>

      <div className="chess-piece-layer">
        {sprites.map((sprite) => (
          <div
            key={sprite.id}
            className={cn('chess-piece-sprite', sprite.exiting && 'is-captured')}
            style={{
              transform: `translate(${sprite.x * 100}%, ${sprite.y * 100}%)`,
              color: sprite.piece[0] === 'w' ? '#ffffff' : '#0a0a0a',
              textShadow: sprite.piece[0] === 'w'
                ? '-1.5px -1.5px 0 #1a1a1a, 1.5px -1.5px 0 #1a1a1a, -1.5px 1.5px 0 #1a1a1a, 1.5px 1.5px 0 #1a1a1a, 0 2px 8px rgba(0,0,0,1)'
                : '-1.5px -1.5px 0 rgba(255,255,255,0.15), 1.5px -1.5px 0 rgba(255,255,255,0.15), -1.5px 1.5px 0 rgba(255,255,255,0.15), 1.5px 1.5px 0 rgba(255,255,255,0.15), 0 1px 4px rgba(0,0,0,0.8)',
            }}
          >
            <span className="chess-piece-glyph">{PIECE_GLYPHS[sprite.piece]}</span>
          </div>
        ))}
      </div>

      {pendingPromotion && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 20,
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              width: 'min(92%, 360px)',
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 16,
              boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
              padding: 16,
            }}
          >
            <div
              style={{
                textAlign: 'center',
                color: 'hsl(var(--foreground))',
                fontWeight: 700,
                marginBottom: 12,
              }}
            >
              Choose Promotion
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 10,
              }}
            >
              {promotionOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => handlePromotionPick(option.key)}
                  style={{
                    height: 72,
                    borderRadius: 12,
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--background))',
                    color: option.piece[0] === 'w' ? '#ffffff' : '#1a1a1a',
                    fontSize: 42,
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease, border-color 0.15s ease, background 0.15s ease',
                    textShadow: option.piece[0] === 'w'
                      ? '-1.5px -1.5px 0 #2a2a2a, 1.5px -1.5px 0 #2a2a2a, -1.5px 1.5px 0 #2a2a2a, 1.5px 1.5px 0 #2a2a2a, 0 2px 6px rgba(0,0,0,0.9)'
                      : '-1px -1px 0 rgba(255,255,255,0.25), 1px -1px 0 rgba(255,255,255,0.25), -1px 1px 0 rgba(255,255,255,0.25), 1px 1px 0 rgba(255,255,255,0.25)',
                  }}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.borderColor = 'hsl(var(--primary))';
                    event.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.borderColor = 'hsl(var(--border))';
                    event.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {PIECE_GLYPHS[option.piece]}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handlePromotionCancel}
              style={{
                marginTop: 12,
                width: '100%',
                height: 40,
                borderRadius: 10,
                border: '1px solid hsl(var(--border))',
                background: 'transparent',
                color: 'hsl(var(--foreground))',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}