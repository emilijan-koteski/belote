package room

type RoomRepository interface {
	Create(room *Room) error
	Update(room *Room) error
	FindByID(id uint) (*Room, error)
	// FindByIDForUpdate is the row-locking variant for use INSIDE a transaction
	// where the caller intends to mutate the room's status or player_count and
	// must serialize against concurrent writers (auto-start vs leave race,
	// AC3). The lock is released when the surrounding tx commits or rolls
	// back. Calling outside a tx degrades to FindByID semantics.
	FindByIDForUpdate(id uint) (*Room, error)
	FindByCode(code string) (*Room, error)
	FindByStatus(status string) ([]Room, error)
	AddPlayer(roomPlayer *RoomPlayer) error
	RemovePlayer(roomID uint, userID uint) error
	FindPlayersByRoomID(roomID uint) ([]RoomPlayer, error)
	FindPlayerRoom(userID uint) (*RoomPlayer, error)
	IncrementPlayerCount(roomID uint) error
	DecrementPlayerCount(roomID uint) error
	UpdatePlayerSeat(roomID uint, userID uint, seat int, team string) error
	ClearPlayerSeat(roomID uint, userID uint) error
	FindPlayerBySeat(roomID uint, seat int) (*RoomPlayer, error)
	FindQuickPlayRoom() (*Room, error)
	// FindQuickPlayRoomExcluding skips room IDs already attempted in the
	// current retry loop. AC5: when counter drift traps the loop on the same
	// drifted room, exclusion lets FindQuickPlayRoom return a different room
	// or fall through to the create-new-room branch.
	FindQuickPlayRoomExcluding(excludedRoomIDs map[uint]bool) (*Room, error)
	UpdateStatus(roomID uint, status string) error
	// FindUserIDsByRoomStatus returns the user IDs of every player currently
	// seated in a room whose status matches the provided value. Used by lobby
	// stats to bucket connected users into "in waiting room" vs "in game".
	FindUserIDsByRoomStatus(status string) ([]uint, error)
	RunInTransaction(fn func(RoomRepository) error) error
}
