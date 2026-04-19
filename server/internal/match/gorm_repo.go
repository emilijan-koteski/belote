package match

import "gorm.io/gorm"

// GormMatchRepository implements MatchRepository using GORM.
type GormMatchRepository struct {
	db *gorm.DB
}

// NewGormMatchRepository creates a new GORM-backed match repository.
func NewGormMatchRepository(db *gorm.DB) *GormMatchRepository {
	return &GormMatchRepository{db: db}
}

func (r *GormMatchRepository) Create(match *Match) error {
	return r.db.Create(match).Error
}

func (r *GormMatchRepository) CreateWithHands(match *Match, hands []HandResult) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(match).Error; err != nil {
			return err
		}
		if len(hands) == 0 {
			return nil
		}
		for i := range hands {
			hands[i].MatchID = match.ID
		}
		return tx.Create(&hands).Error
	})
}

func (r *GormMatchRepository) GetStatsForUser(userID uint) (wins, losses, abandoned int, err error) {
	// Single round-trip: FILTER aggregation over matches the user participates
	// in. The viewer's team per row is derived from their seat via a CASE
	// (seat 0/2 → 0 Red; 1/3 → 1 Blue) matching game.TeamForSeat. A user with
	// zero matches yields (0, 0, 0, nil) — GORM's Scan into zero-valued struct.
	var row struct {
		Wins      int
		Losses    int
		Abandoned int
	}
	err = r.db.Raw(`
SELECT
  COUNT(*) FILTER (
    WHERE status = 'completed' AND winner_team = CASE
      WHEN player1_id = ? THEN 0
      WHEN player2_id = ? THEN 1
      WHEN player3_id = ? THEN 0
      WHEN player4_id = ? THEN 1
    END
  ) AS wins,
  COUNT(*) FILTER (
    WHERE status = 'completed' AND winner_team <> CASE
      WHEN player1_id = ? THEN 0
      WHEN player2_id = ? THEN 1
      WHEN player3_id = ? THEN 0
      WHEN player4_id = ? THEN 1
    END
  ) AS losses,
  COUNT(*) FILTER (WHERE status = 'abandoned') AS abandoned
FROM matches
WHERE player1_id = ? OR player2_id = ? OR player3_id = ? OR player4_id = ?
`,
		userID, userID, userID, userID,
		userID, userID, userID, userID,
		userID, userID, userID, userID,
	).Scan(&row).Error
	if err != nil {
		return 0, 0, 0, err
	}
	return row.Wins, row.Losses, row.Abandoned, nil
}

func (r *GormMatchRepository) GetMatchesForUser(userID uint, limit, offset int) ([]Match, int64, error) {
	query := r.db.Model(&Match{}).
		Where("status IN ?", []string{"completed", "abandoned"}).
		Where(
			"player1_id = ? OR player2_id = ? OR player3_id = ? OR player4_id = ?",
			userID, userID, userID, userID,
		)

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var items []Match
	err := query.
		Preload("Hands", func(db *gorm.DB) *gorm.DB {
			return db.Order("hand_number ASC")
		}).
		Order("completed_at DESC").
		Order("id DESC").
		Limit(limit).
		Offset(offset).
		Find(&items).Error
	if err != nil {
		return nil, 0, err
	}

	return items, total, nil
}
