package room

type RoomRepository interface {
	Create(room *Room) error
	FindByID(id uint) (*Room, error)
}
