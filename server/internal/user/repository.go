package user

type UserRepository interface {
	Create(user *User) error
	FindByEmail(email string) (*User, error)
	FindByUsername(username string) (*User, error)
	FindByID(id uint) (*User, error)
	UpdateLanguagePreference(id uint, lang string) error
}
