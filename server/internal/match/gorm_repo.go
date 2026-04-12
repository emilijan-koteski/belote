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
