package room

type RoomRepository interface {
	Create(room *Room) error
	Update(room *Room) error
	FindByID(id uint) (*Room, error)
	FindByStatus(status string) ([]Room, error)
	AddPlayer(roomPlayer *RoomPlayer) error
	RemovePlayer(roomID uint, userID uint) error
	FindPlayersByRoomID(roomID uint) ([]RoomPlayer, error)
	FindPlayerRoom(userID uint) (*RoomPlayer, error)
	IncrementPlayerCount(roomID uint) error
	DecrementPlayerCount(roomID uint) error
	RunInTransaction(fn func(RoomRepository) error) error
}
