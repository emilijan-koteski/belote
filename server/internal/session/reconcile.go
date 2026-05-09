package session

import (
	"fmt"
	"log/slog"
	"time"

	"github.com/emilijan/beljot/server/internal/match"
	"github.com/emilijan/beljot/server/internal/room"
)

// ReconcileStaleRooms cleans up rooms left in status="playing" by a previous
// process. Sessions live only in process memory, so any "playing" row at boot
// has no live session — its players are stranded by FindPlayerRoom (which
// counts "playing" as active) and cannot quick-play or create a new room
// until that row is closed out.
//
// For each stranded room we (a) best-effort persist a match row with
// status="abandoned" so the player history reflects what happened, then
// (b) flip room.status to "completed" so the lobby treats those players as
// free again. Idempotent: a no-op when nothing is stale, safe to call on
// every boot.
func (m *Manager) ReconcileStaleRooms(roomRepo room.RoomRepository) error {
	rooms, err := roomRepo.FindByStatus("playing")
	if err != nil {
		return fmt.Errorf("listing playing rooms: %w", err)
	}
	if len(rooms) == 0 {
		return nil
	}
	slog.Info("session: reconciling stale playing rooms", "count", len(rooms))
	for i := range rooms {
		if err := m.reconcileStaleRoom(roomRepo, rooms[i]); err != nil {
			slog.Error("session: reconcile failed", "roomID", rooms[i].ID, "error", err)
		}
	}
	return nil
}

func (m *Manager) reconcileStaleRoom(roomRepo room.RoomRepository, r room.Room) error {
	players, err := roomRepo.FindPlayersByRoomID(r.ID)
	if err != nil {
		return fmt.Errorf("loading players: %w", err)
	}

	// matches table requires Player1ID..Player4ID (NOT NULL). A "playing"
	// row with <4 seated players shouldn't normally exist, but if it does
	// we still flip the room status so the lobby unblocks — we just skip
	// the history persistence to avoid a constraint violation.
	var seated [4]uint
	seatedCount := 0
	for _, p := range players {
		if p.Seat != nil && *p.Seat >= 0 && *p.Seat < 4 {
			seated[*p.Seat] = p.UserID
			seatedCount++
		}
	}
	if m.matchRepo != nil && seatedCount == 4 {
		// No precise game-start timestamp survives the restart — the room's
		// UpdatedAt is the best proxy (StartGame is the last writer for a
		// "playing" row that hasn't moved on).
		record := &match.Match{
			RoomID:      r.ID,
			Player1ID:   seated[0],
			Player2ID:   seated[1],
			Player3ID:   seated[2],
			Player4ID:   seated[3],
			TeamAScore:  0,
			TeamBScore:  0,
			WinnerTeam:  0,
			Variant:     r.Variant,
			MatchMode:   r.MatchMode,
			StartedAt:   r.UpdatedAt,
			CompletedAt: time.Now(),
			Status:      "abandoned",
		}
		if err := m.matchRepo.CreateWithHands(record, nil); err != nil {
			slog.Error("session: failed to persist reconciled abandoned match",
				"roomID", r.ID, "error", err)
		}
	}

	if err := roomRepo.UpdateStatus(r.ID, "completed"); err != nil {
		return fmt.Errorf("updating room status: %w", err)
	}
	slog.Info("session: stale room reconciled",
		"roomID", r.ID, "seatedPlayers", seatedCount)
	return nil
}
