import * as React from "react";
import {
  Chessboard,
  ChessboardOptions,
  defaultArrowOptions,
  type Arrow,
  type SquareHandlerArgs,
  type PieceDropHandlerArgs,
} from "react-chessboard";
import { Chess, type Square } from "chess.js";
import {
  type ExplanationBoardCircle,
  normalizeExplanationCircles,
} from "./explanation-shape-colors";

/** Default arrow styling for this board (user `options.arrowOptions` merges on top). */
export const baseChessboardArrowOptions = {
  ...defaultArrowOptions,
  color: "#9a493b",
  secondaryColor: "#9a493b",
  tertiaryColor: "#9a493b",
};

/** Arrows for `BaseChessboard`; `color` defaults to {@link baseChessboardArrowOptions}.color. */
export type BaseChessboardArrow = {
  startSquare: string;
  endSquare: string;
  color?: string;
};

export type BaseChessboardProps = React.ComponentProps<typeof Chessboard>;

export type ChessboardClickToMoveConfig = {
  /**
   * Return all legal moves FROM the given square.
   * You can use chess.js: game.moves({ square, verbose: true })
   */
  getMoves: (square: string) => Array<{ from: string; to: string }>;
  /**
   * Optional: used to detect captures for nicer highlight.
   * With chess.js: game.get(square)
   */
  getPiece?: (square: string) => { color?: string } | null | undefined;
  /**
   * Called when user completes a click-to-move attempt.
   * Return true to accept, false to reject.
   */
  onMove: (from: string, to: string) => boolean;
};

export type BaseChessboardWithClickMoveProps = BaseChessboardProps & {
  /**
   * Enables click-to-move UX (select piece -> highlight moves -> click target).
   * Works independently of drag-to-move.
   */
  clickToMove?: ChessboardClickToMoveConfig;
  /**
   * Optional static circles on squares. Legacy `string[]` (square names only) is supported.
   */
  circles?: string[] | ExplanationBoardCircle[];
  /**
   * Optional arrows (e.g. e2→e4). Merged after `options.arrows` if both are set.
   */
  arrows?: BaseChessboardArrow[];
  /**
   * When set, every square click is delivered here and click-to-move is disabled (for shape editors).
   */
  pickSquare?: (square: string) => void;
};

export function BaseChessboard(props: BaseChessboardWithClickMoveProps) {
  const [moveFrom, setMoveFrom] = React.useState<string>("");
  const [optionSquares, setOptionSquares] = React.useState<
    Record<string, React.CSSProperties>
  >({});

  const clickToMove = props.clickToMove;
  const circlesNormalized = React.useMemo(
    () => normalizeExplanationCircles(props.circles ?? []),
    [props.circles],
  );
  const arrowsFromProp = props.arrows ?? [];
  const position = props.options?.position;

  const normalizedPropArrows = React.useMemo<Arrow[]>(
    () =>
      arrowsFromProp.map((a) => ({
        startSquare: a.startSquare,
        endSquare: a.endSquare,
        color: a.color ?? baseChessboardArrowOptions.color,
      })),
    [arrowsFromProp]
  );

  /** Always an array so react-chessboard clears overlays when a move has no arrows (omitting `arrows` leaves stale lines). */
  const mergedArrows = React.useMemo<Arrow[]>(() => {
    const fromOptions = props.options?.arrows ?? [];
    const all: Arrow[] = [...fromOptions, ...normalizedPropArrows];
    // react-chessboard keys arrows by `${startSquare}-${endSquare}`;
    // duplicate keys break React reconciliation and leak SVG elements.
    // Keep only the last arrow per unique path (so a colored variant wins).
    const unique = new Map<string, Arrow>();
    for (const a of all) unique.set(`${a.startSquare}-${a.endSquare}`, a);
    return Array.from(unique.values());
  }, [props.options?.arrows, normalizedPropArrows]);
  const circleSquares = React.useMemo<Record<string, React.CSSProperties>>(
    () =>
      circlesNormalized.reduce<Record<string, React.CSSProperties>>((acc, c) => {
        acc[c.square] = {
          boxShadow: `inset 0 0 0 3px ${c.color}`,
          borderRadius: "50%",
        };
        return acc;
      }, {}),
    [circlesNormalized],
  );

  const chessForMoves = React.useMemo(() => {
    if (typeof position !== "string") return null;
    try {
      return new Chess(position);
    } catch {
      return null;
    }
  }, [position]);

  const clearSelection = React.useCallback(() => {
    setMoveFrom("");
    setOptionSquares({});
  }, []);

  const getMoveOptions = React.useCallback(
    (square: string) => {
      // If no config provided, we can still support click-to-move,
      // and we will try to calculate legal destinations from `position` (FEN).
      if (!clickToMove) {
        const moves = chessForMoves?.moves({
          square: square as Square,
          verbose: true,
        }) as Array<{ to: string }> | undefined;

        if (!moves || moves.length === 0) {
          setOptionSquares({});
          return false;
        }

        const newSquares: Record<string, React.CSSProperties> = {};
        const fromPiece = chessForMoves?.get(square as Square);

        for (const move of moves) {
          const toPiece = chessForMoves?.get(move.to as Square);
          const isCapture =
            Boolean(toPiece) &&
            Boolean(fromPiece) &&
            toPiece?.color &&
            fromPiece?.color &&
            toPiece.color !== fromPiece.color;

          newSquares[move.to] = {
            background: isCapture
              ? "radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)"
              : "radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)",
            borderRadius: "50%",
          };
        }

        newSquares[square] = { background: "rgba(255, 255, 0, 0.4)" };
        setOptionSquares(newSquares);
        return true;
      }

      const moves = clickToMove.getMoves(square);
      if (moves.length === 0) {
        setOptionSquares({});
        return false;
      }

      const newSquares: Record<string, React.CSSProperties> = {};
      const fromPiece = clickToMove.getPiece?.(square);

      for (const move of moves) {
        const toPiece = clickToMove.getPiece?.(move.to);
        const isCapture =
          Boolean(toPiece) &&
          Boolean(fromPiece) &&
          toPiece?.color &&
          fromPiece?.color &&
          toPiece.color !== fromPiece.color;

        newSquares[move.to] = {
          background: isCapture
            ? "radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)"
            : "radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)",
          borderRadius: "50%",
        };
      }

      newSquares[square] = { background: "rgba(255, 255, 0, 0.4)" };
      setOptionSquares(newSquares);
      return true;
    },
    [chessForMoves, clickToMove]
  );

  const tryMove = React.useCallback(
    (from: string, to: string, piece?: unknown) => {
      if (clickToMove) return clickToMove.onMove(from, to);

      // Fallback: use user's drag handler if provided.
      const drop = props.options?.onPieceDrop as
        | ((args: PieceDropHandlerArgs) => boolean)
        | undefined;
      if (!drop) return false;

      return drop({
        sourceSquare: from as PieceDropHandlerArgs["sourceSquare"],
        targetSquare: to as PieceDropHandlerArgs["targetSquare"],
        // Click-to-move doesn't "drag" a piece, but many handlers don't need it.
        // We still pass through whatever react-chessboard gives us on click.
        piece: (piece ?? "") as unknown as PieceDropHandlerArgs["piece"],
      });
    },
    [clickToMove, props.options]
  );

  const onSquareClick = React.useCallback(
    (args: SquareHandlerArgs) => {
      if (props.pickSquare) {
        props.pickSquare(args.square as string);
        return;
      }

      // Preserve user's onSquareClick if provided
      props.options?.onSquareClick?.(args);

      const square = args.square as string;
      const piece = args.piece as unknown as
        | PieceDropHandlerArgs["piece"]
        | undefined;
      const hasPiece = Boolean(piece);

      if (!moveFrom) {
        if (!hasPiece) return;
        const hasMoveOptions = getMoveOptions(square);
        if (hasMoveOptions) setMoveFrom(square);
        return;
      }

      if (moveFrom === square) {
        clearSelection();
        return;
      }

      // If we have move generation, enforce legal targets; otherwise just attempt
      // and rely on the user's handler to accept/reject.
      if (clickToMove || chessForMoves) {
        const legalTargets = clickToMove
          ? clickToMove.getMoves(moveFrom).map((m) => m.to)
          : (
              (chessForMoves?.moves({
                square: moveFrom as Square,
                verbose: true,
              }) as Array<{ to: string }> | undefined) ?? []
            ).map((m) => m.to);
        const isLegal = legalTargets.includes(square);
        if (!isLegal) {
          const hasMoveOptions = getMoveOptions(square);
          setMoveFrom(hasMoveOptions ? square : "");
          return;
        }
      }

      const ok = tryMove(moveFrom, square, piece);
      if (ok) {
        clearSelection();
      } else {
        // If they clicked another piece, switch selection to that piece.
        if (hasPiece) {
          const hasMoveOptions = getMoveOptions(square);
          setMoveFrom(hasMoveOptions ? square : "");
        } else {
          // keep selection so user can retry
          void getMoveOptions(moveFrom);
        }
      }
    },
    [
      clearSelection,
      chessForMoves,
      clickToMove,
      getMoveOptions,
      moveFrom,
      props.options,
      props.pickSquare,
      tryMove,
    ]
  );

  const options: ChessboardOptions = {
    boardStyle: { overflow: "visible" },
    alphaNotationStyle: {
      fontSize: "1.3rem",
      bottom: "-23px",
      color: "#444",
      right: "14px",
    },
    numericNotationStyle: {
      fontSize: "1rem",
      left: "-10px",
      color: "#444",
    },
    ...props.options,
    onSquareClick,
    arrowOptions: {
      ...baseChessboardArrowOptions,
      ...props.options?.arrowOptions,
    },
    arrows: mergedArrows,
    squareStyles: {
      ...circleSquares,
      ...(props.options?.squareStyles ?? {}),
      ...optionSquares,
    },
  };

  React.useEffect(() => {
    // When position changes (or clickToMove toggles), clear selection/highlights.
    clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.options?.position, Boolean(clickToMove)]);

  // Do not forward clickToMove to Chessboard
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {
    clickToMove: _clickToMove,
    circles: _circles,
    arrows: _arrows,
    pickSquare: _pickSquare,
    ...rest
  } = props;

  return <Chessboard {...rest} options={options} />;
}

export type { Arrow } from "react-chessboard";
