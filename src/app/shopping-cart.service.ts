import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/firestore';
import { Product } from './models/product';
import { take, map } from 'rxjs/operators';
import { ShoppingCart } from './models/shopping-cart';
import { ShoppingCartItem } from './models/shopping-cart-item';

@Injectable({
  providedIn: 'root'
})
export class ShoppingCartService {

  constructor(private afStore: AngularFirestore) { }

  async getCart() {
    let cartId = await this.getOrCreateCartId();
    return this.afStore.collection<ShoppingCart>('shopping-carts').doc(cartId).collection<ShoppingCartItem>('items')
      .valueChanges()
      .pipe(
        map(data => {
          return new ShoppingCart(cartId, data);
        })
      );

    // .snapshotChanges()
    // .pipe(
    //   map(actions => actions.map(a => {
    //     const data = a.payload.doc.data();
    //     const id = a.payload.doc.id;
    //     return { id, ...data };
    //   }))
    // ).pipe(
    //   map(data => {
    //     return new ShoppingCart(cartId, data);
    //   })
    // );

  }

  async addToCart(product: Product) {
    this.updateItemQuantity(product, 1);
  }

  async removeFromCart(product: Product) {
    this.updateItemQuantity(product, -1);
  }

  async clearCart() {
    let cartId = await this.getOrCreateCartId();
    this.afStore.collection('shopping-carts').doc(cartId).collection('items').stateChanges()
      .pipe(
        map(actions => actions.map(a => {
          const id = a.payload.doc.id;
          return id;
        }))
      )
      .subscribe((ids) => {
        ids.forEach(item => {
          let item$ = this.getItem(cartId, item);
          item$.snapshotChanges().subscribe(item => {
            item$.delete();
          });
        })
      });
    localStorage.removeItem('cartId');
    await this.getCart();
  }

  private createCart() {
    return this.afStore.collection('shopping-carts').add({
      dateCreated: new Date().getTime()
    }).then(ref => {
      return this.afStore.collection('shopping-carts').doc(ref.id).update({
        id: ref.id
      }).then(() => ref);
    });
  }

  private async getOrCreateCartId(): Promise<string> {
    let cartId = localStorage.getItem('cartId');

    if (cartId) return cartId;

    let result = await this.createCart();
    localStorage.setItem('cartId', result.id);
    return result.id;
  }

  private getItem(cartId: string, productId: string) {
    return this.afStore.collection('shopping-carts').doc(cartId).collection('items').doc(productId);
  }

  private async updateItemQuantity(product: Product, change: number) {
    let cartId = await this.getOrCreateCartId();
    let item$ = this.getItem(cartId, product.id);
    item$.snapshotChanges()
      .pipe(take(1)).subscribe(item => {
        let quantity = (item.payload.get('quantity') || 0) + change;
        if (quantity === 0) {
          item$.delete();
        } else {
          item$.set({ id: product.id, product: product, quantity: quantity });
        }
      });
  }

}
